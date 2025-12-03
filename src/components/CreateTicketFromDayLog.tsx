import { useState, useEffect } from 'react';
import { Plus, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
}

interface CreateTicketFromDayLogProps {
  daylogId: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultCompanyId?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const categoryOptions = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'linkedin_ads', label: 'LinkedIn Ads' },
  { value: 'arte', label: 'Arte' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'outro', label: 'Outro' },
];

export function CreateTicketFromDayLog({
  daylogId,
  defaultTitle = '',
  defaultDescription = '',
  defaultCompanyId = '',
  trigger,
  onSuccess,
}: CreateTicketFromDayLogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: defaultDescription,
    company_id: defaultCompanyId,
    category: 'outro' as string,
    priority: 'media' as string,
  });

  useEffect(() => {
    if (open) {
      fetchCompanies();
      setFormData({
        title: defaultTitle,
        description: defaultDescription,
        company_id: defaultCompanyId,
        category: 'outro',
        priority: 'media',
      });
    }
  }, [open, defaultTitle, defaultDescription, defaultCompanyId]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (data) setCompanies(data);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.company_id) {
      toast.error('Preencha o título e selecione uma empresa');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: formData.title,
          description_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: formData.description }] }] },
          company_id: formData.company_id,
          category: formData.category as 'meta_ads' | 'google_ads' | 'linkedin_ads' | 'arte' | 'relatorio' | 'outro',
          priority: formData.priority as 'baixa' | 'media' | 'alta' | 'urgente',
          created_by: user?.id,
          daylog_id: daylogId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Demanda criada com sucesso!');
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast.error('Erro ao criar demanda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Demanda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Criar Demanda a partir do DayLog
          </DialogTitle>
          <DialogDescription>
            A demanda será automaticamente vinculada a este DayLog.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da Demanda *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Otimizar campanha Meta Ads"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa *</Label>
            <Select 
              value={formData.company_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}
            >
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detalhes da demanda..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Criando...' : 'Criar Demanda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}