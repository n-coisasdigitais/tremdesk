import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Company, Ticket, TicketCategory, TicketStatus } from '@/types';
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Download, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';

const categoryLabels: Record<TicketCategory, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  linkedin_ads: 'LinkedIn Ads',
  arte: 'Arte/Criação',
  relatorio: 'Relatório',
  outro: 'Outro',
};

const statusLabels: Record<TicketStatus, string> = {
  novo: 'Novo',
  em_andamento: 'Em Andamento',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const COLORS = ['#3B82F6', '#F59E0B', '#F97316', '#10B981', '#6B7280', '#EF4444'];
const CATEGORY_COLORS = ['#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#6B7280'];

export default function Reports() {
  const { isAdmin, isTeamMember, roles } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, companiesRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, company:companies(*), creator:profiles!tickets_created_by_fkey(*), assignee:profiles!tickets_assigned_to_fkey(*)')
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('*').order('name'),
      ]);

      setTickets((ticketsRes.data || []) as Ticket[]);
      setCompanies((companiesRes.data || []) as Company[]);
    } finally {
      setLoading(false);
    }
  };

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Company filter
      if (selectedCompany !== 'all' && ticket.company_id !== selectedCompany) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && ticket.category !== selectedCategory) {
        return false;
      }

      // Date filter
      if (dateRange?.from && dateRange?.to) {
        const ticketDate = new Date(ticket.created_at);
        if (!isWithinInterval(ticketDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, selectedCompany, selectedCategory, dateRange]);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    const completed = filteredTickets.filter((t) => t.status === 'concluido').length;
    const inProgress = filteredTickets.filter((t) => ['em_andamento', 'aguardando_aprovacao'].includes(t.status)).length;
    const overdue = filteredTickets.filter((t) => {
      if (!t.due_date || t.status === 'concluido' || t.status === 'cancelado') return false;
      return new Date(t.due_date) < new Date();
    }).length;

    // Average completion time (for completed tickets)
    const completedTickets = filteredTickets.filter((t) => t.status === 'concluido' && t.completed_at);
    const avgCompletionDays = completedTickets.length > 0
      ? completedTickets.reduce((acc, t) => {
          const created = new Date(t.created_at);
          const completed = new Date(t.completed_at!);
          return acc + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / completedTickets.length
      : 0;

    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
    };
  }, [filteredTickets]);

  // Chart data
  const statusChartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredTickets.forEach((ticket) => {
      statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status as TicketStatus],
      value: count,
    }));
  }, [filteredTickets]);

  const categoryChartData = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    filteredTickets.forEach((ticket) => {
      categoryCounts[ticket.category] = (categoryCounts[ticket.category] || 0) + 1;
    });

    return Object.entries(categoryCounts).map(([category, count]) => ({
      name: categoryLabels[category as TicketCategory],
      value: count,
    }));
  }, [filteredTickets]);

  const timelineChartData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return {
        date: format(date, 'dd/MM'),
        criadas: 0,
        concluidas: 0,
      };
    });

    filteredTickets.forEach((ticket) => {
      const createdDate = format(new Date(ticket.created_at), 'dd/MM');
      const createdIndex = last30Days.findIndex((d) => d.date === createdDate);
      if (createdIndex >= 0) {
        last30Days[createdIndex].criadas++;
      }

      if (ticket.completed_at) {
        const completedDate = format(new Date(ticket.completed_at), 'dd/MM');
        const completedIndex = last30Days.findIndex((d) => d.date === completedDate);
        if (completedIndex >= 0) {
          last30Days[completedIndex].concluidas++;
        }
      }
    });

    return last30Days;
  }, [filteredTickets]);

  const companyChartData = useMemo(() => {
    const companyCounts: Record<string, number> = {};
    filteredTickets.forEach((ticket) => {
      const companyName = ticket.company?.name || 'Sem empresa';
      companyCounts[companyName] = (companyCounts[companyName] || 0) + 1;
    });

    return Object.entries(companyCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredTickets]);

  const exportCSV = () => {
    const headers = ['Título', 'Empresa', 'Categoria', 'Prioridade', 'Status', 'Criado em', 'Prazo', 'Concluído em'];
    const rows = filteredTickets.map((t) => [
      t.title,
      t.company?.name || '',
      categoryLabels[t.category],
      t.priority,
      statusLabels[t.status],
      format(new Date(t.created_at), 'dd/MM/yyyy'),
      t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy') : '',
      t.completed_at ? format(new Date(t.completed_at), 'dd/MM/yyyy') : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-demandas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análise de demandas e performance</p>
          </div>
          <Button onClick={exportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {(isAdmin || isTeamMember) && (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Empresa" />
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
              )}

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-64 justify-start text-left">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                          {format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
                      )
                    ) : (
                      'Selecionar período'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Demandas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total}</div>
              <p className="text-xs text-muted-foreground">No período selecionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.completed}</div>
              <p className="text-xs text-muted-foreground">
                Taxa: {metrics.completionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.inProgress}</div>
              <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgCompletionDays} dias</div>
              <p className="text-xs text-muted-foreground">
                {metrics.overdue > 0 && <span className="text-red-500">{metrics.overdue} atrasadas</span>}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>Visão geral das demandas por status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Categoria</CardTitle>
              <CardDescription>Tipos de demandas mais solicitados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))">
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Linha do Tempo</CardTitle>
              <CardDescription>Demandas criadas vs concluídas nos últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="criadas" stroke="#3B82F6" strokeWidth={2} name="Criadas" />
                    <Line type="monotone" dataKey="concluidas" stroke="#10B981" strokeWidth={2} name="Concluídas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Company Distribution (Admin/Team only) */}
          {(isAdmin || isTeamMember) && companyChartData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Demandas por Cliente</CardTitle>
                <CardDescription>Top 10 clientes com mais demandas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
