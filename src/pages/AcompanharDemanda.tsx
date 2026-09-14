import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { toast } from "sonner";

// Mesmos rótulos usados no Kanban interno (Kanban.tsx / statusConfig).
const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_andamento: "Em Andamento",
  bloqueado: "Bloqueado",
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
  due_date: string | null;
  completed_at: string | null;
}

interface HistoricoItem {
  id: string;
  author_name: string;
  is_client: boolean;
  content_json: unknown;
  created_at: string;
}

// Os comentários são salvos no formato do editor (TipTap). Aqui só
// precisamos do texto puro para exibir na linha do tempo pública.
function extrairTexto(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extrairTexto).join("");
  if (typeof content === "object") {
    const node = content as { type?: string; text?: string; content?: unknown };
    if (node.text) return node.text;
    const inner = extrairTexto(node.content);
    return node.type === "paragraph" ? `${inner}\n` : inner;
  }
  return "";
}

export default function AcompanharDemanda() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketPublico | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarHistorico = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc("get_ticket_history_by_token", { p_token: token });
    if (!error) setHistorico((data || []) as HistoricoItem[]);
  }, [token]);

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
        await carregarHistorico();
      }
      setLoading(false);
    };
    fetchTicket();
  }, [token, carregarHistorico]);

  const enviarMensagem = async () => {
    if (!token || !novaMensagem.trim()) return;
    setEnviando(true);
    const { error } = await supabase.rpc("add_ticket_comment_by_token", {
      p_token: token,
      p_content: novaMensagem.trim(),
    });
    setEnviando(false);

    if (error) {
      toast.error("Não foi possível enviar sua mensagem. Tente novamente.");
      return;
    }

    setNovaMensagem("");
    toast.success("Mensagem enviada!");
    await carregarHistorico();
  };


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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Previsão de conclusão</p>
              <p className="text-sm font-medium">
                {ticket.due_date
                  ? format(new Date(`${ticket.due_date}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "A definir"}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Conclusão real</p>
              <p className="text-sm font-medium">
                {ticket.completed_at
                  ? format(new Date(ticket.completed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                  : "Em andamento"}
              </p>
            </div>
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
