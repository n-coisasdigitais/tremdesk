import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Company, Ticket, TicketCategory, TicketStatus } from '@/types';
import { DayLog, TAG_COLORS, DAYLOG_TAGS } from '@/hooks/useDayLogs';
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
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
import { Download, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Calendar, ClipboardList, FileText, User } from 'lucide-react';
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
  bloqueado: 'Bloqueado',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  arquivado: 'Arquivado',
};

const COLORS = ['#3B82F6', '#F59E0B', '#F97316', '#10B981', '#6B7280', '#EF4444'];
const CATEGORY_COLORS = ['#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#6B7280'];

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function Reports() {
  const { isAdmin, isTeamMember, roles } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dayLogs, setDayLogs] = useState<DayLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('demandas');

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  // DayLog Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [daylogDateRange, setDaylogDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, companiesRes, dayLogsRes, profilesRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, company:companies(*), creator:profiles!tickets_created_by_fkey(*), assignee:profiles!tickets_assigned_to_fkey(*)')
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('*').order('name'),
        supabase.from('day_logs').select('*').order('date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, avatar_url').order('full_name'),
      ]);

      setTickets((ticketsRes.data || []) as Ticket[]);
      setCompanies((companiesRes.data || []) as Company[]);
      setProfiles((profilesRes.data || []) as Profile[]);

      // Merge profiles into day_logs
      if (dayLogsRes.data && profilesRes.data) {
        const profilesMap = new Map(profilesRes.data.map(p => [p.id, p]));
        const logsWithProfiles = dayLogsRes.data.map(log => ({
          ...log,
          profiles: profilesMap.get(log.user_id) || null
        }));
        setDayLogs(logsWithProfiles as DayLog[]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (selectedCompany !== 'all' && ticket.company_id !== selectedCompany) return false;
      if (selectedCategory !== 'all' && ticket.category !== selectedCategory) return false;
      if (dateRange?.from && dateRange?.to) {
        const ticketDate = new Date(ticket.created_at);
        if (!isWithinInterval(ticketDate, { start: dateRange.from, end: dateRange.to })) return false;
      }
      return true;
    });
  }, [tickets, selectedCompany, selectedCategory, dateRange]);

  // Filter DayLogs
  const filteredDayLogs = useMemo(() => {
    return dayLogs.filter((log) => {
      if (selectedUser !== 'all' && log.user_id !== selectedUser) return false;
      if (selectedTag !== 'all' && !log.tags?.includes(selectedTag)) return false;
      if (daylogDateRange?.from && daylogDateRange?.to) {
        const logDate = parseISO(log.date);
        if (!isWithinInterval(logDate, { start: daylogDateRange.from, end: daylogDateRange.to })) return false;
      }
      return true;
    });
  }, [dayLogs, selectedUser, selectedTag, daylogDateRange]);

  // DayLog aggregated data
  const daylogMetrics = useMemo(() => {
    const totalLogs = filteredDayLogs.length;
    const logsWithPending = filteredDayLogs.filter(log => log.work_pending && log.work_pending.trim().length > 0).length;
    const logsWithNextSteps = filteredDayLogs.filter(log => log.next_steps && log.next_steps.trim().length > 0).length;
    const uniqueUsers = new Set(filteredDayLogs.map(log => log.user_id)).size;

    // Tag distribution
    const tagCounts: Record<string, number> = {};
    filteredDayLogs.forEach(log => {
      log.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return { totalLogs, logsWithPending, logsWithNextSteps, uniqueUsers, tagCounts };
  }, [filteredDayLogs]);

  // Group DayLogs by date for display
  const groupedDayLogs = useMemo(() => {
    const groups: Record<string, DayLog[]> = {};
    filteredDayLogs.forEach(log => {
      const date = log.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredDayLogs]);

  // Computed metrics for tickets
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    const completed = filteredTickets.filter((t) => t.status === 'concluido').length;
    const inProgress = filteredTickets.filter((t) => ['em_andamento', 'aguardando_aprovacao'].includes(t.status)).length;
    const overdue = filteredTickets.filter((t) => {
      if (!t.due_date || t.status === 'concluido' || t.status === 'cancelado') return false;
      return new Date(t.due_date) < new Date();
    }).length;

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
      return { date: format(date, 'dd/MM'), criadas: 0, concluidas: 0 };
    });

    filteredTickets.forEach((ticket) => {
      const createdDate = format(new Date(ticket.created_at), 'dd/MM');
      const createdIndex = last30Days.findIndex((d) => d.date === createdDate);
      if (createdIndex >= 0) last30Days[createdIndex].criadas++;

      if (ticket.completed_at) {
        const completedDate = format(new Date(ticket.completed_at), 'dd/MM');
        const completedIndex = last30Days.findIndex((d) => d.date === completedDate);
        if (completedIndex >= 0) last30Days[completedIndex].concluidas++;
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

  const tagChartData = useMemo(() => {
    return Object.entries(daylogMetrics.tagCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [daylogMetrics.tagCounts]);

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

  const exportDayLogCSV = () => {
    const headers = ['Data', 'Usuário', 'O que foi feito', 'Pendente', 'Próximos Passos', 'Tags'];
    const rows = filteredDayLogs.map((log) => [
      format(parseISO(log.date), 'dd/MM/yyyy'),
      log.profiles?.full_name || '',
      log.work_done.replace(/\n/g, ' '),
      log.work_pending?.replace(/\n/g, ' ') || '',
      log.next_steps?.replace(/\n/g, ' ') || '',
      log.tags?.join(', ') || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-daylogs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
            <p className="text-muted-foreground">Análise de demandas e atividades diárias</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full max-w-md ${(isAdmin || isTeamMember) ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="demandas" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Demandas
            </TabsTrigger>
            {(isAdmin || isTeamMember) && (
              <TabsTrigger value="daylogs" className="gap-2">
                <FileText className="h-4 w-4" />
                DayLogs
              </TabsTrigger>
            )}
          </TabsList>

          {/* DEMANDAS TAB */}
          <TabsContent value="demandas" className="space-y-6">
            <div className="flex justify-end">
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
          </TabsContent>

          {/* DAYLOGS TAB - Only visible for admin and team_member */}
          {(isAdmin || isTeamMember) && (
          <TabsContent value="daylogs" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={exportDayLogCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Exportar CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>

            {/* DayLog Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {DAYLOG_TAGS.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <Calendar className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {daylogDateRange?.from ? (
                            daylogDateRange.to ? (
                              <>
                                {format(daylogDateRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                                {format(daylogDateRange.to, 'dd/MM/yy', { locale: ptBR })}
                              </>
                            ) : (
                              format(daylogDateRange.from, 'dd/MM/yy', { locale: ptBR })
                            )
                          ) : (
                            'Selecionar período'
                          )}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={daylogDateRange?.from}
                        selected={daylogDateRange}
                        onSelect={setDaylogDateRange}
                        numberOfMonths={1}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* DayLog Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{daylogMetrics.totalLogs}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">No período</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium">Usuários</CardTitle>
                  <User className="h-4 w-4 text-blue-500 hidden sm:block" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{daylogMetrics.uniqueUsers}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Ativos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pendências</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500 hidden sm:block" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{daylogMetrics.logsWithPending}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Com pendente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium">Próx. Passos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500 hidden sm:block" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{daylogMetrics.logsWithNextSteps}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Planejado</p>
                </CardContent>
              </Card>
            </div>

            {/* Tag Distribution Chart */}
            {tagChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Tags</CardTitle>
                  <CardDescription>Atividades mais frequentes por categoria</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tagChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))">
                          {tagChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DayLog Lists */}
            <div className="grid grid-cols-1 gap-4 lg:gap-6">
              {/* O que foi feito */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    O que foi feito
                  </CardTitle>
                  <CardDescription>Trabalhos concluídos no período</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {groupedDayLogs.map(([date, logs]) => (
                        <div key={date} className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                            {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </h4>
                          {logs.map((log) => (
                            <div key={log.id} className="pl-2 border-l-2 border-green-500/30">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={log.profiles?.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {log.profiles?.full_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium">{log.profiles?.full_name}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{log.work_done}</p>
                              {log.tags && log.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {log.tags.map((tag) => (
                                    <Badge 
                                      key={tag} 
                                      variant="secondary" 
                                      className={`text-[10px] ${TAG_COLORS[tag]?.bg || ''} ${TAG_COLORS[tag]?.text || ''}`}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                      {groupedDayLogs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhum registro encontrado
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* O que está pendente */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    O que está pendente
                  </CardTitle>
                  <CardDescription>Trabalhos em aberto reportados</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {groupedDayLogs
                        .map(([date, logs]) => {
                          const logsWithPending = logs.filter(log => log.work_pending && log.work_pending.trim().length > 0);
                          if (logsWithPending.length === 0) return null;
                          return (
                            <div key={date} className="space-y-2">
                              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                                {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                              </h4>
                              {logsWithPending.map((log) => (
                                <div key={log.id} className="pl-2 border-l-2 border-orange-500/30">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={log.profiles?.avatar_url || undefined} />
                                      <AvatarFallback className="text-[10px]">
                                        {log.profiles?.full_name?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium">{log.profiles?.full_name}</span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{log.work_pending}</p>
                                </div>
                              ))}
                            </div>
                          );
                        })
                        .filter(Boolean)}
                      {filteredDayLogs.filter(l => l.work_pending && l.work_pending.trim()).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhuma pendência registrada
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Próximos Passos */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Próximos Passos
                  </CardTitle>
                  <CardDescription>Planejamento e próximas ações definidas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {groupedDayLogs
                        .map(([date, logs]) => {
                          const logsWithNextSteps = logs.filter(log => log.next_steps && log.next_steps.trim().length > 0);
                          if (logsWithNextSteps.length === 0) return null;
                          return (
                            <div key={date} className="space-y-2">
                              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">
                                {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {logsWithNextSteps.map((log) => (
                                  <div key={log.id} className="pl-2 border-l-2 border-blue-500/30">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={log.profiles?.avatar_url || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                          {log.profiles?.full_name?.charAt(0) || '?'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs font-medium">{log.profiles?.full_name}</span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{log.next_steps}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                        .filter(Boolean)}
                      {filteredDayLogs.filter(l => l.next_steps && l.next_steps.trim()).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhum próximo passo definido
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
