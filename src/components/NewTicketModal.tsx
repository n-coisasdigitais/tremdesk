import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TipTapEditor } from './TipTapEditor';
import { useTickets } from '@/hooks/useTickets';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Company, TicketCategory, TicketPriority } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'linkedin_ads', label: 'LinkedIn Ads' },
  { value: 'arte', label: 'Arte/Criação' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'outro', label: 'Outro' },
];

const priorities: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'bg-blue-500' },
  { value: 'media', label: 'Média', color: 'bg-yellow-500' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-500' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-500' },
];

export const NewTicketModal = ({ open, onOpenChange }: NewTicketModalProps) => {
  const { createTicket } = useTickets();
  const { isAdmin, isTeamMember, roles } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<any>(null);
  const [category, setCategory] = useState<TicketCategory>('outro');
  const [priority, setPriority] = useState<TicketPriority>('media');
  const [companyId, setCompanyId] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase.from('companies').select('*').order('name');
      if (data) {
        setCompanies(data as Company[]);
        // Se não for admin/team, seleciona a empresa do usuário
        if (!isAdmin && !isTeamMember && roles.length > 0 && roles[0].company_id) {
          setCompanyId(roles[0].company_id);
        }
      }
    };
    if (open) {
      fetchCompanies();
    }
  }, [open, isAdmin, isTeamMember, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !companyId || !category) return;

    setLoading(true);
    try {
      await createTicket({
        title,
        description_json: description,
        category,
        priority,
        company_id: companyId,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      });
      
      // Reset form
      setTitle('');
      setDescription(null);
      setCategory('outro');
      setPriority('media');
      setDueDate(undefined);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Campanha Black Friday - Meta Ads"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={companyId} onValueChange={setCompanyId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.color}`} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <TipTapEditor
              content={description}
              onChange={setDescription}
              placeholder="Descreva a demanda... Use @nome para mencionar alguém"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !title || !companyId}>
              {loading ? 'Criando...' : 'Criar Demanda'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
