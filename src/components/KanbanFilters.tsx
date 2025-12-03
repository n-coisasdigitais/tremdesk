import { useState, useEffect } from 'react';
import { Filter, X, Building2, Tag, User, Calendar, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, TicketCategory } from '@/types';

interface Company {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
}

export interface KanbanFiltersState {
  companyId: string;
  category: string;
  assigneeId: string;
  hasDaylog: boolean | null;
}

interface KanbanFiltersProps {
  filters: KanbanFiltersState;
  onFiltersChange: (filters: KanbanFiltersState) => void;
}

const categoryOptions: { value: TicketCategory; label: string }[] = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'linkedin_ads', label: 'LinkedIn Ads' },
  { value: 'arte', label: 'Arte' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'outro', label: 'Outro' },
];

export function KanbanFilters({ filters, onFiltersChange }: KanbanFiltersProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [assignees, setAssignees] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchAssignees();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (data) setCompanies(data);
  };

  const fetchAssignees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');
    if (data) setAssignees(data);
  };

  const activeFilterCount = [
    filters.companyId,
    filters.category,
    filters.assigneeId,
    filters.hasDaylog !== null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      companyId: '',
      category: '',
      assigneeId: '',
      hasDaylog: null,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Company Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Empresa
            </Label>
            <Select 
              value={filters.companyId || 'all'} 
              onValueChange={(value) => onFiltersChange({ ...filters, companyId: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4" />
              Categoria
            </Label>
            <Select 
              value={filters.category || 'all'} 
              onValueChange={(value) => onFiltersChange({ ...filters, category: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Responsável
            </Label>
            <Select 
              value={filters.assigneeId || 'all'} 
              onValueChange={(value) => onFiltersChange({ ...filters, assigneeId: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os responsáveis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DayLog Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              Vínculo com DayLog
            </Label>
            <Select 
              value={filters.hasDaylog === null ? 'all' : filters.hasDaylog ? 'yes' : 'no'} 
              onValueChange={(value) => onFiltersChange({ 
                ...filters, 
                hasDaylog: value === 'all' ? null : value === 'yes' 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Com DayLog vinculado</SelectItem>
                <SelectItem value="no">Sem DayLog vinculado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to filter tickets
export function filterTickets(tickets: Ticket[], filters: KanbanFiltersState): Ticket[] {
  return tickets.filter((ticket) => {
    if (filters.companyId && ticket.company_id !== filters.companyId) {
      return false;
    }
    if (filters.category && ticket.category !== filters.category) {
      return false;
    }
    if (filters.assigneeId && ticket.assigned_to !== filters.assigneeId) {
      return false;
    }
    if (filters.hasDaylog !== null) {
      const hasDaylog = !!(ticket as any).daylog_id;
      if (filters.hasDaylog !== hasDaylog) {
        return false;
      }
    }
    return true;
  });
}