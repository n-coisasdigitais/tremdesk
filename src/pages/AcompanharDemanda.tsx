import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatedLogo } from "@/components/AnimatedLogo";

// Mesmos rótulos usados no Kanban interno (Kanban.tsx / statusConfig).
const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_andamento: "Em Andamento",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  arquivado: "Arquivado",
};

interface TicketPublico {
  protocolo: string;
  title: string;
  status: string;
  category: string;
  company_name: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export default function AcompanharDemanda() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketPublico | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    const fetchTicket = async () => {
      if (!token) {
        setNaoEncontrado(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_ticket_by_token", { p_token: token });

      if (error || !data || data.length === 0) {
        setNaoEncontrado(true);
      } else {
        setTicket(data[0] as TicketPublico);
      }
      setLoading(false);
    };
    fetchTicket();
  }, [token]);

  if (loading) {
    return (
      <CenteredShell>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CenteredShell>
    );
  }

  if (naoEncontrado || !ticket) {
    return (
      <CenteredShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Demanda não encontrada</CardTitle>
            <CardDescription>Confira o link recebido por e-mail.</CardDescription>
          </CardHeader>
        </Card>
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardDescription>
            Protocolo {ticket.protocolo} · {ticket.company_name}
          </CardDescription>
          <CardTitle>{ticket.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge className="text-sm" variant="secondary">
            {statusLabels[ticket.status] || ticket.status}
          </Badge>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Aberta em {format(new Date(ticket.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
            <p>
              Última atualização em {format(new Date(ticket.updated_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
            {ticket.completed_at && (
              <p>Concluída em {format(new Date(ticket.completed_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 bg-background">
      <AnimatedLogo />
      {children}
    </div>
  );
}
