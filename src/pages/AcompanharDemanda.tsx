import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  MessageSquareText,
  Paperclip,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaticLogo } from "@/components/AnimatedLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const mainStages = ["novo", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido"] as const;

const statusConfig: Record<string, { label: string; dot: string; soft: string; text: string }> = {
  novo: { label: "Novo", dot: "bg-status-new", soft: "bg-status-new/10", text: "text-status-new" },
  em_andamento: { label: "Em andamento", dot: "bg-status-progress", soft: "bg-status-progress/10", text: "text-status-progress" },
  bloqueado: { label: "Bloqueado", dot: "bg-status-blocked", soft: "bg-status-blocked/10", text: "text-status-blocked" },
  aguardando_aprovacao: { label: "Aguardando aprovação", dot: "bg-status-waiting", soft: "bg-status-waiting/10", text: "text-status-waiting" },
  aprovado: { label: "Aprovado", dot: "bg-status-approved", soft: "bg-status-approved/10", text: "text-status-approved" },
  concluido: { label: "Concluído", dot: "bg-status-completed", soft: "bg-status-completed/10", text: "text-status-completed" },
  cancelado: { label: "Cancelado", dot: "bg-status-cancelled", soft: "bg-status-cancelled/10", text: "text-status-cancelled" },
  arquivado: { label: "Arquivado", dot: "bg-status-archived", soft: "bg-status-archived/10", text: "text-status-archived" },
};

interface TicketPublico {
  protocolo: string;
  title: string;
  status: string;
  category: string;
  company_name: string;
  company_logo_url: string | null;
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

interface PublicAttachment {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
}

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function attachmentIcon(fileType: string | null, fileName: string) {
  if (fileType?.startsWith("image/")) return FileImage;
  if (fileType?.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) return FileText;
  if (fileType?.includes("zip") || /\.(zip|rar|7z)$/i.test(fileName)) return FileArchive;
  return File;
}

export default function AcompanharDemanda() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketPublico | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [attachments, setAttachments] = useState<PublicAttachment[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc("get_ticket_history_by_token", { p_token: token });
    if (!error) setHistorico((data || []) as HistoricoItem[]);
  }, [token]);

  const carregarAnexos = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.functions.invoke("demanda-publica", {
      body: { action: "listar_anexos", token },
    });
    if (!error && !data?.error) setAttachments((data?.attachments || []) as PublicAttachment[]);
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
        await Promise.all([carregarHistorico(), carregarAnexos()]);
      }
      setLoading(false);
    };
    fetchTicket();
  }, [token, carregarHistorico, carregarAnexos]);

  const currentStageIndex = useMemo(() => {
    if (!ticket) return -1;
    if (ticket.status === "bloqueado") return 1;
    return mainStages.indexOf(ticket.status as (typeof mainStages)[number]);
  }, [ticket]);

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

  const abrirAnexo = async (attachmentId: string) => {
    if (!token) return;
    setOpeningAttachmentId(attachmentId);
    const popup = window.open("", "_blank");
    const { data, error } = await supabase.functions.invoke("demanda-publica", {
      body: { action: "abrir_anexo", token, attachment_id: attachmentId },
    });
    setOpeningAttachmentId(null);

    if (error || data?.error || !data?.url) {
      popup?.close();
      toast.error("Não foi possível abrir este anexo.");
      return;
    }
    if (popup) popup.location.href = data.url;
    else window.location.href = data.url;
  };

  if (loading) {
    return <CenteredShell><Loader2 className="h-7 w-7 animate-spin text-primary" /></CenteredShell>;
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

  const currentStatus = statusConfig[ticket.status] || statusConfig.novo;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <StaticLogo size="sm" />
          <div className="flex min-w-0 items-center gap-3 border-l pl-4">
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Portal de atendimento</p>
              <p className="truncate text-sm font-semibold">{ticket.company_name}</p>
            </div>
            <Avatar className="h-10 w-10 rounded-md border bg-background">
              <AvatarImage className="object-contain p-1" src={ticket.company_logo_url || undefined} alt={`Logo ${ticket.company_name}`} />
              <AvatarFallback className="rounded-md text-xs font-semibold">
                {ticket.company_logo_url ? <Building2 className="h-4 w-4" /> : initials(ticket.company_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{ticket.protocolo}</span>
                <Badge variant="outline" className={cn("gap-2 border-transparent", currentStatus.soft, currentStatus.text)}>
                  <span className={cn("h-2 w-2 rounded-full", currentStatus.dot)} />
                  {currentStatus.label}
                </Badge>
              </div>
              <h1 className="max-w-3xl text-2xl font-bold sm:text-3xl">{ticket.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Aberta em {format(new Date(ticket.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              Atualizada em {format(new Date(ticket.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </section>

        <section aria-label="Etapas da demanda" className="mb-6 overflow-x-auto border-y bg-card px-2 py-5 sm:px-5">
          <div className="flex min-w-[650px] items-start">
            {mainStages.map((stage, index) => {
              const config = statusConfig[stage];
              const isComplete = index < currentStageIndex || ticket.status === "concluido";
              const isCurrent = index === currentStageIndex && ticket.status !== "bloqueado";
              return (
                <div key={stage} className="relative flex flex-1 flex-col items-center text-center">
                  {index > 0 && <div className={cn("absolute right-1/2 top-3 h-0.5 w-full", index <= currentStageIndex ? config.dot : "bg-border")} />}
                  <div className={cn("relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card", (isComplete || isCurrent) ? cn("border-transparent", config.dot) : "border-border")}>
                    {isComplete && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    {isCurrent && <span className="h-2 w-2 rounded-full bg-card" />}
                  </div>
                  <span className={cn("mt-2 max-w-28 text-xs font-medium", isCurrent ? config.text : "text-muted-foreground")}>{config.label}</span>
                </div>
              );
            })}
          </div>
          {ticket.status === "bloqueado" && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-status-blocked">
              <span className="h-2 w-2 rounded-full bg-status-blocked" /> Demanda temporariamente bloqueada
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4" /> Histórico</CardTitle>
                <CardDescription>Acompanhe as atualizações e converse com a equipe.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {historico.length === 0 ? (
                  <p className="border-y py-6 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
                ) : (
                  <div className="space-y-0">
                    {historico.map((item, index) => (
                      <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {index < historico.length - 1 && <div className="absolute bottom-0 left-4 top-8 w-px bg-border" />}
                        <Avatar className={cn("z-10 h-8 w-8 border", item.is_client ? "bg-primary" : "bg-secondary")}>
                          <AvatarFallback className="text-xs font-semibold">{initials(item.author_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 rounded-md border bg-background p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{item.author_name}</p>
                            <span className="text-xs text-muted-foreground">{format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{extrairTexto(item.content_json).trim()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
                  <Textarea
                    aria-label="Nova mensagem"
                    placeholder="Escreva uma mensagem para a equipe..."
                    value={novaMensagem}
                    onChange={(event) => setNovaMensagem(event.target.value)}
                    rows={4}
                    maxLength={5000}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{novaMensagem.length}/5000</span>
                    <Button onClick={enviarMensagem} disabled={enviando || !novaMensagem.trim()}>
                      {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Enviar mensagem
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Prazos</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Previsão de conclusão</p><p className="font-medium">{ticket.due_date ? format(new Date(`${ticket.due_date}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "A definir"}</p></div>
                </div>
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Conclusão real</p><p className="font-medium">{ticket.completed_at ? format(new Date(ticket.completed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Em andamento"}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Paperclip className="h-4 w-4" /> Anexos</CardTitle>
                <CardDescription>{attachments.length ? `${attachments.length} arquivo${attachments.length > 1 ? "s" : ""}` : "Nenhum arquivo"}</CardDescription>
              </CardHeader>
              {attachments.length > 0 && (
                <CardContent className="space-y-2">
                  {attachments.map((attachment) => {
                    const Icon = attachmentIcon(attachment.file_type, attachment.file_name);
                    return (
                      <div key={attachment.id} className="flex items-center gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={attachment.file_name}>{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                        </div>
                        <Button variant="ghost" size="icon" aria-label={`Abrir ${attachment.file_name}`} onClick={() => abrirAnexo(attachment.id)} disabled={openingAttachmentId === attachment.id}>
                          {openingAttachmentId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          </aside>
        </div>
      </main>
      <footer className="mt-8 border-t bg-card py-5 text-center text-xs text-muted-foreground">Atendimento por N Coisas Digitais</footer>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4"><StaticLogo />{children}</div>;
}