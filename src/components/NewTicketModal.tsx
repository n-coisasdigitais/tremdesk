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
import { Checkbox } from '@/components/ui/checkbox';
import { TicketCategorySelect } from './TicketCategorySelect';
import { useCategories } from '@/hooks/useCategories';
import { useSavedContacts } from '@/hooks/useSavedContacts';

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorities: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'bg-blue-500' },
  { value: 'media', label: 'Média', color: 'bg-yellow-500' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-500' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-500' },
];

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export const NewTicketModal = ({ open, onOpenChange }: NewTicketModalProps) => {
  const { createTicket } = useTickets();
  const { assignCategories } = useCategories();
  const { isAdmin, isTeamMember, roles } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<any>(null);
  // Categorias reais vêm de Admin > Categorias (ticket_categories). O campo
  // legado "category" (enum) continua sendo preenchido com 'outro' só para
  // satisfazer a coluna NOT NULL da tabela.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priority, setPriority] = useState<TicketPriority>('media');
  const [companyId, setCompanyId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [requiresApproval, setRequiresApproval] = useState(false);
  // Solicitante: pessoa que pediu a demanda. Recebe status/movimentações por
  // e-mail, mesmo sem ter login. Se um dia criar conta com o mesmo e-mail,
  // as demandas são vinculadas a ela automaticamente (trigger no banco).
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [saveContact, setSaveContact] = useState(false);
  const { contacts, createContact } = useSavedContacts();

  const handleContactPick = (email: string) => {
    const contact = contacts.find((c) => c.email === email.toLowerCase().trim());
    if (contact) setSolicitanteNome(contact.name);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch companies
      const { data: companiesData } = await supabase.from('companies').select('*').order('name');
      if (companiesData) {
        setCompanies(companiesData as Company[]);
        // Se não for admin/team, seleciona a empresa do usuário
        if (!isAdmin && !isTeamMember && roles.length > 0 && roles[0].company_id) {
          setCompanyId(roles[0].company_id);
        }
      }
      
      // Fetch team members for assignment
      if (isAdmin || isTeamMember) {
        const { data: teamData } = await supabase
          .from('user_roles')
          .select('user_id, profiles:user_id(id, full_name, avatar_url)')
          .in('role', ['admin', 'team_member']);
        
        if (teamData) {
          const members = teamData
            .map((t: any) => t.profiles)
            .filter(Boolean) as TeamMember[];
          setTeamMembers(members);
        }
      }
    };
    if (open) {
      fetchData();
    }
  }, [open, isAdmin, isTeamMember, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !companyId) return;

    setLoading(true);
    try {
      const { data } = await createTicket({
        title,
        description_json: description,
        category: 'outro' as TicketCategory,
        priority,
        company_id: companyId,
        assigned_to: assignedTo || null,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        requires_approval: requiresApproval,
        solicitante_nome: solicitanteNome.trim() || null,
        solicitante_email: solicitanteEmail.trim().toLowerCase() || null,
      });

      if (data?.id && selectedCategories.length > 0) {
        await assignCategories(data.id, selectedCategories);
      }

      if (saveContact && solicitanteNome.trim() && solicitanteEmail.trim()) {
        const exists = contacts.some(
          (c) => c.email === solicitanteEmail.trim().toLowerCase()
        );
        if (!exists) {
          await createContact({
            name: solicitanteNome.trim(),
            email: solicitanteEmail.trim(),
          });
        }
      }

      // Reset form
      setSolicitanteNome('');
      setSolicitanteEmail('');
      setSaveContact(false);
      setTitle('');
      setDescription(null);
      setSelectedCategories([]);
      setPriority('media');
      setAssignedTo('');
      setDueDate(undefined);
      setRequiresApproval(false);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label>Categorias</Label>
              <TicketCategorySelect
                selectedCategories={selectedCategories}
                onCategoriesChange={setSelectedCategories}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Solicitante</Label>
              <p className="text-xs text-muted-foreground">
                Quem pediu a demanda. Recebe o status e as movimentações por e-mail.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="solicitante_nome">Nome</Label>
                <Input
                  id="solicitante_nome"
                  value={solicitanteNome}
                  onChange={(e) => setSolicitanteNome(e.target.value)}
                  placeholder="Ex: Maria Souza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="solicitante_email">E-mail</Label>
                <Input
                  id="solicitante_email"
                  type="email"
                  list="solicitante-contatos"
                  value={solicitanteEmail}
                  onChange={(e) => {
                    setSolicitanteEmail(e.target.value);
                    handleContactPick(e.target.value);
                  }}
                  placeholder="maria@empresa.com"
                />
                <datalist id="solicitante-contatos">
                  {contacts.map((c) => (
                    <option key={c.id} value={c.email}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save_contact"
                checked={saveContact}
                onCheckedChange={(checked) => setSaveContact(checked === true)}
              />
              <Label htmlFor="save_contact" className="text-sm font-normal cursor-pointer">
                Salvar na lista de contatos
              </Label>
            </div>
          </div>

          {(isAdmin || isTeamMember) && (
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo || 'unassigned'} onValueChange={(v) => setAssignedTo(v === 'unassigned' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label>Previsão de conclusão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{dueDate ? format(dueDate, 'PPP', { locale: ptBR }) : 'Selecionar data'}</span>
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

          {(isAdmin || isTeamMember) && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_approval"
                checked={requiresApproval}
                onCheckedChange={(checked) => setRequiresApproval(checked === true)}
              />
              <Label htmlFor="requires_approval" className="text-sm font-normal cursor-pointer">
                Esta demanda precisa de aprovação do cliente (artes/peças)
              </Label>
            </div>
          )}

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
