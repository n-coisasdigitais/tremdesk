import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  ExternalLink
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  total: number;
  novo: number;
  em_andamento: number;
  aguardando_aprovacao: number;
  concluido: number;
}

export default function Dashboard() {
  const { isAdmin, isTeamMember, roles } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [roles]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get company info for client users
      if (!isAdmin && !isTeamMember && roles.length > 0) {
        const companyId = roles[0]?.company_id;
        if (companyId) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();
          setCompany(companyData);
        }
      }

      // Fetch ticket stats
      let query = supabase
        .from('tickets')
        .select('status');

      const { data: tickets } = await query;

      if (tickets) {
        const stats: DashboardStats = {
          total: tickets.length,
          novo: tickets.filter(t => t.status === 'novo').length,
          em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
          aguardando_aprovacao: tickets.filter(t => t.status === 'aguardando_aprovacao').length,
          concluido: tickets.filter(t => t.status === 'concluido').length,
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral das suas demandas
            </p>
          </div>
          <Button onClick={() => navigate('/kanban')}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Demanda
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Demandas"
            value={stats?.total || 0}
            icon={TrendingUp}
            color="text-blue-500"
          />
          <StatCard
            title="Em Andamento"
            value={stats?.em_andamento || 0}
            icon={Clock}
            color="text-yellow-500"
          />
          <StatCard
            title="Aguardando Aprovação"
            value={stats?.aguardando_aprovacao || 0}
            icon={AlertCircle}
            color="text-orange-500"
          />
          <StatCard
            title="Concluídas"
            value={stats?.concluido || 0}
            icon={CheckCircle2}
            color="text-green-500"
          />
        </div>

        {/* Quick Actions for Clients */}
        {company && !isAdmin && !isTeamMember && (
          <div className="grid gap-4 md:grid-cols-2">
            {company.leads_system_url && (
              <Card className="hover:border-primary transition-colors cursor-pointer"
                    onClick={() => window.open(company.leads_system_url, '_blank')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>🎯 Gestão de Leads</span>
                    <ExternalLink className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Acesse seu painel de leads
                  </p>
                </CardContent>
              </Card>
            )}
            {company.assas_portal_url && (
              <Card className="hover:border-primary transition-colors cursor-pointer"
                    onClick={() => window.open(company.assas_portal_url, '_blank')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>💳 Minhas Faturas</span>
                    <ExternalLink className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Boletos e pagamentos
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Demandas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-blue-50">Novo</Badge>
                  <span className="text-sm text-muted-foreground">
                    {stats?.novo || 0} demandas
                  </span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-blue-500"
                    style={{
                      width: `${stats?.total ? (stats.novo / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-yellow-50">Em Andamento</Badge>
                  <span className="text-sm text-muted-foreground">
                    {stats?.em_andamento || 0} demandas
                  </span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-yellow-500"
                    style={{
                      width: `${stats?.total ? (stats.em_andamento / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-orange-50">Aguardando Aprovação</Badge>
                  <span className="text-sm text-muted-foreground">
                    {stats?.aguardando_aprovacao || 0} demandas
                  </span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-orange-500"
                    style={{
                      width: `${stats?.total ? (stats.aguardando_aprovacao / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-green-50">Concluído</Badge>
                  <span className="text-sm text-muted-foreground">
                    {stats?.concluido || 0} demandas
                  </span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${stats?.total ? (stats.concluido / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/kanban')} size="lg">
            Ver todas as demandas
          </Button>
        </div>
      </div>
    </Layout>
  );
}
