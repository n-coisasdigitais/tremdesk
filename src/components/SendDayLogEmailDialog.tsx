import { useState, useEffect } from 'react';
import { Mail, Plus, X, Send, Search, Users, Bookmark, Check, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSavedContacts, SavedContact } from '@/hooks/useSavedContacts';
import { tiptapJsonToHtml } from '@/components/DayLogTipTapEditor';

interface SendDayLogEmailDialogProps {
  dayLogId: string;
  dayLogDate: string;
  trigger?: React.ReactNode;
}

interface DayLogPreview {
  description: string | null;
  work_done: string;
  work_pending: string | null;
  next_steps: string | null;
  work_done_json: any | null;
  work_pending_json: any | null;
  next_steps_json: any | null;
  tags: string[] | null;
  transcription_url: string | null;
  ai_assistant_url: string | null;
  meeting_notes: string | null;
  profiles?: { full_name: string } | null;
  companies?: { name: string } | null;
}

export function SendDayLogEmailDialog({ 
  dayLogId, 
  dayLogDate,
  trigger 
}: SendDayLogEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveAsContact, setSaveAsContact] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('recipients');
  const [dayLogPreview, setDayLogPreview] = useState<DayLogPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  const { toast } = useToast();
  const { contacts, loading: loadingContacts, fetchContacts, createContact } = useSavedContacts();

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const fetchDayLogPreview = async () => {
    if (dayLogPreview) return; // Already loaded
    
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase
        .from('day_logs')
        .select(`
          description,
          work_done,
          work_pending,
          next_steps,
          work_done_json,
          work_pending_json,
          next_steps_json,
          tags,
          transcription_url,
          ai_assistant_url,
          meeting_notes,
          user_id,
          companies:company_id (name)
        `)
        .eq('id', dayLogId)
        .single();
      
      if (error) throw error;
      
      // Fetch profile separately
      if (data?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user_id)
          .single();
        
        setDayLogPreview({ ...data, profiles: profile });
      } else {
        setDayLogPreview(data);
      }
    } catch (error) {
      console.error('Error fetching daylog preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAddEmail = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    
    if (!isValidEmail(email)) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um email válido.',
        variant: 'destructive',
      });
      return;
    }
    
    if (recipients.includes(email)) {
      toast({
        title: 'Email duplicado',
        description: 'Este email já foi adicionado.',
        variant: 'destructive',
      });
      return;
    }
    
    // Save as contact if checkbox is checked
    if (saveAsContact && nameInput.trim()) {
      await createContact({
        name: nameInput.trim(),
        email,
      });
    }
    
    setRecipients([...recipients, email]);
    setEmailInput('');
    setNameInput('');
    setSaveAsContact(false);
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
    // Also remove from selected contacts if it was a saved contact
    const contact = contacts.find(c => c.email === email);
    if (contact) {
      const newSelected = new Set(selectedContacts);
      newSelected.delete(contact.id);
      setSelectedContacts(newSelected);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const toggleContactSelection = (contact: SavedContact) => {
    const newSelected = new Set(selectedContacts);
    
    if (newSelected.has(contact.id)) {
      newSelected.delete(contact.id);
      // Remove from recipients
      setRecipients(recipients.filter(r => r !== contact.email));
    } else {
      newSelected.add(contact.id);
      // Add to recipients if not already there
      if (!recipients.includes(contact.email)) {
        setRecipients([...recipients, contact.email]);
      }
    }
    
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    const allEmails = filteredContacts.map(c => c.email);
    const allIds = new Set(filteredContacts.map(c => c.id));
    
    // Merge with existing recipients (avoiding duplicates)
    const newRecipients = [...new Set([...recipients, ...allEmails])];
    setRecipients(newRecipients);
    setSelectedContacts(new Set([...selectedContacts, ...allIds]));
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast({
        title: 'Nenhum destinatário',
        description: 'Adicione pelo menos um email para enviar.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-daylog-email', {
        body: {
          day_log_id: dayLogId,
          recipients,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email enviado!',
        description: `DayLog enviado para ${recipients.length} destinatário${recipients.length > 1 ? 's' : ''}.`,
      });

      setOpen(false);
      setRecipients([]);
      setSelectedContacts(new Set());
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message || 'Não foi possível enviar o email.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEmailInput('');
      setNameInput('');
      setRecipients([]);
      setSearchQuery('');
      setSaveAsContact(false);
      setSelectedContacts(new Set());
      setActiveTab('recipients');
      setDayLogPreview(null);
    } else {
      // Refresh contacts when opening
      fetchContacts();
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'preview' && !dayLogPreview) {
      fetchDayLogPreview();
    }
  };

  // Render content helper
  const renderContent = (jsonContent: any, plainText: string | null): string => {
    if (jsonContent) {
      return tiptapJsonToHtml(jsonContent);
    }
    if (plainText) {
      return plainText.split('\n').map(line => 
        line.trim() ? `<p style="margin: 4px 0;">${line}</p>` : ''
      ).join('');
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Mail className="h-4 w-4" />
            Enviar por Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar DayLog por Email
          </DialogTitle>
          <DialogDescription>
            Envie este DayLog ({dayLogDate}) por email para os destinatários selecionados.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recipients" className="gap-2">
              <Users className="h-4 w-4" />
              Destinatários {recipients.length > 0 && `(${recipients.length})`}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview do Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipients" className="flex-1 overflow-hidden flex flex-col space-y-4 py-4 mt-0">
            {/* Saved Contacts Section */}
            {contacts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Contatos Salvos
                  </Label>
                  {filteredContacts.length > 0 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs"
                    >
                      Selecionar todos
                    </Button>
                  )}
                </div>
                
                {/* Search contacts */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar contatos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {/* Contacts list */}
                <ScrollArea className="h-[120px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {loadingContacts ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Carregando...
                      </p>
                    ) : filteredContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {searchQuery ? 'Nenhum contato encontrado' : 'Nenhum contato salvo'}
                      </p>
                    ) : (
                      filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedContacts.has(contact.id) ? 'bg-muted' : ''
                          }`}
                          onClick={() => toggleContactSelection(contact)}
                        >
                          <Checkbox 
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => toggleContactSelection(contact)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          </div>
                          {contact.company && (
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              {contact.company}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator />

            {/* Add new email */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar novo destinatário
              </Label>
              
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={handleAddEmail}
                  disabled={!isValidEmail(emailInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Save as contact option */}
              {emailInput && isValidEmail(emailInput) && (
                <div className="space-y-2 p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="saveContact" 
                      checked={saveAsContact}
                      onCheckedChange={(checked) => setSaveAsContact(checked === true)}
                    />
                    <Label htmlFor="saveContact" className="text-sm flex items-center gap-2 cursor-pointer">
                      <Bookmark className="h-4 w-4" />
                      Salvar como contato
                    </Label>
                  </div>
                  
                  {saveAsContact && (
                    <Input
                      placeholder="Nome do contato"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Recipients list */}
            {recipients.length > 0 && (
              <div className="space-y-2">
                <Label>Destinatários ({recipients.length})</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md max-h-[80px] overflow-y-auto">
                  {recipients.map((email) => (
                    <Badge 
                      key={email} 
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[400px] rounded-md border">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-muted-foreground">Carregando preview...</p>
                </div>
              ) : dayLogPreview ? (
                <div className="p-4 space-y-4">
                  {/* Email Header Preview */}
                  <div className="bg-gradient-to-r from-primary/80 to-primary rounded-t-lg p-6 text-center text-primary-foreground">
                    <h2 className="text-xl font-bold">📋 DayLog</h2>
                    <p className="text-sm opacity-90">{dayLogDate}</p>
                  </div>

                  {/* Email Body Preview */}
                  <div className="space-y-4">
                    {/* Author */}
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {dayLogPreview.profiles?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{dayLogPreview.profiles?.full_name || 'Usuário'}</p>
                        {dayLogPreview.companies?.name && (
                          <p className="text-sm text-muted-foreground">{dayLogPreview.companies.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Recipients preview */}
                    {recipients.length > 1 && (
                      <div className="p-3 bg-muted/50 rounded-md text-sm">
                        <span className="text-muted-foreground">
                          📨 <strong>Será enviado para:</strong> {recipients.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {dayLogPreview.description && (
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                          Resumo do dia
                        </h3>
                        <p className="text-lg font-medium">{dayLogPreview.description}</p>
                      </div>
                    )}

                    {/* Work Done */}
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                      <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                        ✅ O que foi feito
                      </h3>
                      <div 
                        className="text-sm prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ 
                          __html: renderContent(dayLogPreview.work_done_json, dayLogPreview.work_done) 
                        }}
                      />
                    </div>

                    {/* Work Pending */}
                    {(dayLogPreview.work_pending || dayLogPreview.work_pending_json) && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                        <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                          ⏳ O que ficou pendente
                        </h3>
                        <div 
                          className="text-sm prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ 
                            __html: renderContent(dayLogPreview.work_pending_json, dayLogPreview.work_pending) 
                          }}
                        />
                      </div>
                    )}

                    {/* Next Steps */}
                    {(dayLogPreview.next_steps || dayLogPreview.next_steps_json) && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          🎯 Próximos passos
                        </h3>
                        <div 
                          className="text-sm prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ 
                            __html: renderContent(dayLogPreview.next_steps_json, dayLogPreview.next_steps) 
                          }}
                        />
                      </div>
                    )}

                    {/* Tags */}
                    {dayLogPreview.tags && dayLogPreview.tags.length > 0 && (
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                          Tags
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {dayLogPreview.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meeting Notes */}
                    {dayLogPreview.meeting_notes && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="font-semibold mb-2">📝 Notas de reunião</h3>
                        <p className="text-sm whitespace-pre-wrap">{dayLogPreview.meeting_notes}</p>
                      </div>
                    )}

                    {/* Links */}
                    {(dayLogPreview.transcription_url || dayLogPreview.ai_assistant_url) && (
                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                          Links
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                          {dayLogPreview.transcription_url && (
                            <Badge variant="outline">📄 Transcrição</Badge>
                          )}
                          {dayLogPreview.ai_assistant_url && (
                            <Badge variant="outline">🤖 IA/Assistente</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Preview */}
                  <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                    <p>Este email foi enviado pelo Sistema de Demandas.</p>
                    <p>Relatório gerado automaticamente (horário de Brasília).</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-muted-foreground">Não foi possível carregar o preview.</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || recipients.length === 0}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Enviando...' : `Enviar Email${recipients.length > 0 ? ` (${recipients.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
