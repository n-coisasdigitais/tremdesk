import { useState } from 'react';
import { Mail, Plus, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  const [recipients, setRecipients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = () => {
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
    
    setRecipients([...recipients, email]);
    setEmailInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
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
      setRecipients([]);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar DayLog por Email
          </DialogTitle>
          <DialogDescription>
            Envie este DayLog ({dayLogDate}) por email para os destinatários selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adicionar destinatário</Label>
            <div className="flex gap-2">
              <Input
                id="email"
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
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {recipients.length > 0 && (
            <div className="space-y-2">
              <Label>Destinatários ({recipients.length})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md min-h-[60px]">
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
