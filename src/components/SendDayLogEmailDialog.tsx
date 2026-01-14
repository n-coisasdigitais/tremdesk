import { useState, useEffect } from 'react';
import { Mail, Plus, X, Send, Search, Users, Bookmark, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

interface SendDayLogEmailDialogProps {
  dayLogId: string;
  dayLogDate: string;
  trigger?: React.ReactNode;
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
    } else {
      // Refresh contacts when opening
      fetchContacts();
    }
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar DayLog por Email
          </DialogTitle>
          <DialogDescription>
            Envie este DayLog ({dayLogDate}) por email para os destinatários selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
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
              <ScrollArea className="h-[150px] rounded-md border">
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
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md max-h-[100px] overflow-y-auto">
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

          {/* Email content preview */}
          <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
            <p>📧 O email será enviado com um layout formatado contendo:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Resumo do dia</li>
              <li>O que foi feito</li>
              <li>Pendências e próximos passos</li>
              <li>Tags e links externos</li>
            </ul>
          </div>
        </div>

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
            {sending ? 'Enviando...' : 'Enviar Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
