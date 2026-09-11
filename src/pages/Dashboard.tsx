import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  ExternalLink,
  Megaphone,
  AlertTriangle,
  Info,
  BarChart3,
  CreditCard,
  X,
  Copy,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// NOVO — mesma base usada em src/pages/admin/Companies.tsx. Se a empresa
// tiver um slug cadastrado, este é o link público que qualquer pessoa da
// equipe do cliente pode usar para abrir uma nova demanda, sem login.
const PUBLIC_FORM_BASE_URL = "https://atendimento.ncoisas.digital/nova-demanda";

interface DashboardStats {
  total: number;
  novo: number;
  em_andamento: number;
  aguardando_aprovacao: number;
  concluido: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  notify_page: boolean;
}

interface SystemLink {
  id: string;
  name: string;
  url: string;
  icon: "leads" | "finance";
  description: string;
}

export default function Dashboard() {
  const { isAdmin, isTeamMember, roles } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [systemLinks, setSystemLinks] = useState<SystemLink[]>([]);
  // NOVO — feedback visual do botão "Copiar link"
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchAnnouncements();
    fetchSystemLinks();

    // Load dismissed announcements from localStorage
    const dismissed = localStorage.getItem("dismissedAnnouncements");
    if (dismissed) {
      setDismissedAnnouncements(JSON.parse(dismissed));
    }
  }, [roles]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get company info for client users
      if (!isAdmin && !isTeamMember && roles.length > 0) {
        const companyId = roles[0]?.company_id;
        if (companyId) {
          const { data: companyData } = await supabase.from("companies").select("*").eq("id", companyId).single();
          setCompany(companyData);
        }
      }

      // Fetch ticket stats
      let query = supabase.from("tickets").select("status");

      const { data: tickets } = await query;

      if (tickets) {
        const stats: DashboardStats = {
          total: tickets.length,
          novo: tickets.filter((t) => t.status === "novo").length,
          em_andamento: tickets.filter((t) => t.status === "em_andamento").length,
          aguardando_aprovacao: tickets.filter((t) => t.status === "aguardando_aprovacao").length,
          concluido: tickets.filter((t) => t.status === "concluido").length,
        };
        setStats(stats);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .eq("notify_page", true)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setAnnouncements(data);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const fetchSystemLinks = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", [
          "system_link_leads_url",
          "system_link_leads_name",
          "system_link_finance_url",
          "system_link_finance_name",
        ]);

      if (data) {
        const settings: Record<string, string> = {};
        data.forEach((s) => {
          if (s.value) settings[s.key] = s.value;
        });

        const links: SystemLink[] = [];

        if (settings["system_link_leads_url"]) {
          links.push({
            id: "leads",
            name: settings["system_link_leads_name"] || "Dashboard de Campanhas",
            url: settings["system_link_leads_url"],
            icon: "leads",
            description: "Acompanhe suas campanhas e métricas",
          });
        }

        if (settings["system_link_finance_url"]) {
          links.push({
            id: "finance",
            name: settings["system_link_finance_name"] || "Portal Financeiro",
            url: settings["system_link_finance_url"],
            icon: "finance",
            description: "Faturas e cobranças",
          });
        }

        setSystemLinks(links);
      }
    } catch (error) {
      console.error("Error fetching system links:", error);
    }
  };

  const dismissAnnouncement = (id: string) => {
    const newDismissed = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(newDismissed);
    localStorage.setItem("dismissedAnnouncements", JSON.stringify(newDismissed));
  };

  const visibleAnnouncements = announcements.filter((a) => !dismissedAnnouncements.includes(a.id));

  // NOVO — copia o link público do formulário de nova demanda desta empresa
  const handleCopyPublicFormLink = async () => {
    if (!company?.slug) return;
    const url = `${PUBLIC_FORM_BASE_URL}?e=${company.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({
        title: "Link copiado!",
        description: "Compartilhe com quem mais precisar abrir demandas na sua empresa.",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: url,
        variant: "destructive",
      });
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

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-destructive bg-destructive/5";
      case "important":
        return "border-amber-500 bg-amber-500/5";
      default:
        return "border-primary bg-primary/5";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "important":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
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
            <p className="text-muted-foreground">Visão geral das suas demandas</p>
          </div>
          <Button onClick={() => navigate("/kanban")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Demanda
          </Button>
        </div>

        {/* Announcements Alert Banner */}
        {visibleAnnouncements.length > 0 && (
          <div className="space-y-3">
            {visibleAnnouncements.map((announcement) => (
              <Card key={announcement.id} className={`border-l-4 ${getPriorityStyles(announcement.priority)}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {getPriorityIcon(announcement.priority)}
                      <div>
                        <h4 className="font-semibold">{announcement.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{announcement.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(announcement.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => dismissAnnouncement(announcement.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total de Demandas" value={stats?.total || 0} icon={TrendingUp} color="text-blue-500" />
          <StatCard title="Em Andamento" value={stats?.em_andamento || 0} icon={Clock} color="text-yellow-500" />
          <StatCard
            title="Aguardando Aprovação"
            value={stats?.aguardando_aprovacao || 0}
            icon={AlertCircle}
            color="text-orange-500"
          />
          <StatCard title="Concluídas" value={stats?.concluido || 0} icon={CheckCircle2} color="text-green-500" />
        </div>

        {/* NOVO — link público de "nova demanda" desta empresa, visível para
            quem está logado como cliente, para compartilhar com colegas que
            não têm conta no sistema. */}
        {company && !isAdmin && !isTeamMember && company.slug && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LinkIcon className="h-4 w-4 text-primary" />
                Link para abrir novas demandas
              </CardTitle>
              <CardDescription>
                Compartilhe este link com qualquer pessoa da {company.name} — não é preciso ter login para abrir uma
                solicitação por aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs sm:text-sm truncate">
                  {`${PUBLIC_FORM_BASE_URL}?e=${company.slug}`}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyPublicFormLink} className="shrink-0">
                  {linkCopied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                  {linkCopied ? "Copiado!" : "Copiar link"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* External System Links - For all users */}
        {(systemLinks.length > 0 || company) && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Show configured system links for admins/team */}
            {(isAdmin || isTeamMember) &&
              systemLinks.map((link) => (
                <Card
                  key={link.id}
                  className="hover:border-primary transition-colors cursor-pointer group"
                  onClick={() => window.open(link.url, "_blank")}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {link.icon === "leads" ? (
                          <BarChart3 className="h-5 w-5 text-primary" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-primary" />
                        )}
                        {link.name}
                      </span>
                      <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  </CardContent>
                </Card>
              ))}

            {/* Show company-specific links for clients */}
            {company && !isAdmin && !isTeamMember && (
              <>
                {company.leads_system_url && (
                  <Card
                    className="hover:border-primary transition-colors cursor-pointer group"
                    onClick={() => window.open(company.leads_system_url, "_blank")}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          Gestão de Leads
                        </span>
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Acesse seu painel de leads e campanhas</p>
                    </CardContent>
                  </Card>
                )}
                {company.assas_portal_url && (
                  <Card
                    className="hover:border-primary transition-colors cursor-pointer group"
                    onClick={() => window.open(company.assas_portal_url, "_blank")}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                          Minhas Faturas
                        </span>
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Boletos e pagamentos</p>
                    </CardContent>
                  </Card>
                )}
              </>
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
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                    Novo
                  </Badge>
                  <span className="text-sm text-muted-foreground">{stats?.novo || 0} demandas</span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-blue-500"
                    style={{
                      width: `${stats?.total ? (stats.novo / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                    Em Andamento
                  </Badge>
                  <span className="text-sm text-muted-foreground">{stats?.em_andamento || 0} demandas</span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-yellow-500"
                    style={{
                      width: `${stats?.total ? (stats.em_andamento / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">
                    Aguardando Aprovação
                  </Badge>
                  <span className="text-sm text-muted-foreground">{stats?.aguardando_aprovacao || 0} demandas</span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-orange-500"
                    style={{
                      width: `${stats?.total ? (stats.aguardando_aprovacao / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                    Concluído
                  </Badge>
                  <span className="text-sm text-muted-foreground">{stats?.concluido || 0} demandas</span>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${stats?.total ? (stats.concluido / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate("/kanban")} size="lg">
            Ver todas as demandas
          </Button>
        </div>
      </div>
    </Layout>
  );
}
