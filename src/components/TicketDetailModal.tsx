import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TipTapEditor } from "./TipTapEditor";
import { TicketAttachments } from "./TicketAttachments";
import { TicketChecklist } from "./TicketChecklist";
import { TicketLinks } from "./TicketLinks";
import { ApprovalItemsPanel } from "./ApprovalItemsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEmailNotifications } from "@/hooks/useEmailNotifications";
import { Ticket, TicketComment, Approval, Profile } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  X,
  Clock,
  MessageSquare,
  Activity,
  Send,
  UserPlus,
  Trash2,
  Archive,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CheckCircle2 } from "lucide-react";

// NOVO — base do link público de acompanhamento (mesma lógica usada no
// formulário de nova demanda). Todo ticket tem token_acompanhamento
// preenchido automaticamente pelo banco (default gen_random_uuid()).
const TRACKING_BASE_URL = "https://atendimento.ncoisas.digital/acompanhar";

interface TicketDetailModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusConfig = {
  novo: { label: "Novo", color: "bg-blue-500" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500" },
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "bg-orange-500" },
  aprovado: { label: "Aprovado", color: "bg-green-500" },
  concluido: { label: "Concluído", color: "bg-gray-500" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
  arquivado: { label: "Arquivado", color: "bg-slate-500" },
};

const priorityConfig = {
  baixa: { label: "Baixa", color: "bg-blue-100 text-blue-800" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-800" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-800" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-800" },
};

interface ActivityItem {
  id: string;
  type: "comment" | "activity" | "approval";
  created_at: string;
  user?: Profile;
  content?: any;
  action_type?: string;
  metadata_json?: any;
  status?: string;
  feedback_json?: any;
}

export const TicketDetailModal = ({ ticket, open, onOpenChange, onUpdate }: TicketDetailModalProps) => {
  const { user, profile, isAdmin, isTeamMember, isClientAdmin, isClientUser } = useAuth();
  const isClient = isClientAdmin || isClientUser;
  const { toast } = useToast();
  const { notifyMention, notifyTicketUpdated } = useEmailNotifications();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [newComment, setNewComment] = useState<any>(null);
  const [approvalFeedback, setApprovalFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  // NOVO — feedback visual do botão "Copiar link de acompanhamento"
  const [trackingLinkCopied, setTrackingLinkCopied] = useState(false);

  useEffect(() => {
    if (ticket && open) {
      fetchData();
      fetchTeamMembers();
    }
  }, [ticket, open]);

  const fetchTeamMembers = async () => {
    if (!ticket) return;

    // Fetch team members who have access to this company
    const { data: teamClients } = await supabase
      .from("team_clients")
      .select("team_id")
      .eq("company_id", ticket.company_id);

    if (!teamClients || teamClients.length === 0) {
      // If no team is assigned, fetch all team members
      const { data: allTeamMembers } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name, avatar_url)")
        .in("role", ["admin", "team_member"]);

      if (allTeamMembers) {
        const profiles = allTeamMembers.map((tm: any) => tm.profiles).filter(Boolean);
        setTeamMembers(profiles);
      }
      return;
    }

    const teamIds = teamClients.map((tc) => tc.team_id);

    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, profiles:user_id(id, full_name, avatar_url)")
      .in("team_id", teamIds);

    if (members) {
      const profiles = members.map((m: any) => m.profiles).filter(Boolean);
      // Add admins too
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, full_name, avatar_url)")
        .eq("role", "admin");

      const adminProfiles = admins?.map((a: any) => a.profiles).filter(Boolean) || [];
      const allProfiles = [...profiles, ...adminProfiles];
      // Remove duplicates
      const uniqueProfiles = allProfiles.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
      setTeamMembers(uniqueProfiles);
    }
  };

  const fetchData = async () => {
    if (!ticket) return;

    // Fetch comments
    const { data: commentsData } = await supabase
      .from("ticket_comments")
      .select("*, user:profiles(*)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    // Fetch activities
    const { data: activitiesData } = await supabase
      .from("ticket_activities")
      .select("*, user:profiles(*)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    // Fetch approvals
    const { data: approvalsData } = await supabase
      .from("approvals")
      .select("*, approved_by:profiles(*)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    // Build timeline
    const timelineItems: ActivityItem[] = [
      ...(commentsData || []).map((c: any) => ({
        ...c,
        type: "comment" as const,
      })),
      ...(activitiesData || []).map((a: any) => ({
        ...a,
        type: "activity" as const,
      })),
      ...(approvalsData || []).map((a: any) => ({
        ...a,
        type: "approval" as const,
        user: a.approved_by,
      })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setComments(commentsData || []);
    setActivities(activitiesData || []);
    setApprovals((approvalsData || []) as any);
    setTimeline(timelineItems);
  };

  const handleAddComment = async () => {
    if (!ticket || !newComment || !user) return;

    setLoading(true);
    try {
      const { data: commentData, error } = await supabase
        .from("ticket_comments")
        .insert([
          {
            ticket_id: ticket.id,
            user_id: user.id,
            content_json: newComment,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Check for mentions in the content and create notifications
      const mentions = extractMentions(newComment);
      const commentPreview = extractTextPreview(newComment);

      for (const mentionedUserId of mentions) {
        // Create mention record
        await supabase.from("mentions").insert([
          {
            ticket_id: ticket.id,
            mentioned_user_id: mentionedUserId,
            mentioned_by: user.id,
            comment_id: commentData?.id,
          },
        ]);

        // Create in-app notification
        await supabase.from("notifications").insert([
          {
            user_id: mentionedUserId,
            type: "mention",
            ticket_id: ticket.id,
            reference_id: commentData?.id,
          },
        ]);

        // Send email notification
        await notifyMention(mentionedUserId, ticket.title, profile?.full_name || "Alguém", commentPreview);
      }

      setNewComment(null);
      await fetchData();
      toast({ title: "Comentário adicionado!" });
    } catch (error: any) {
      toast({ title: "Erro ao adicionar comentário", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const extractTextPreview = (content: any): string => {
    const texts: string[] = [];
    const traverse = (node: any) => {
      if (node.type === "text" && node.text) {
        texts.push(node.text);
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    if (content?.content) {
      content.content.forEach(traverse);
    }
    const fullText = texts.join(" ");
    return fullText.length > 150 ? fullText.substring(0, 150) + "..." : fullText;
  };

  const extractMentions = (content: any): string[] => {
    const mentions: string[] = [];
    const traverse = (node: any) => {
      if (node.type === "mention" && node.attrs?.id) {
        mentions.push(node.attrs.id);
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    if (content?.content) {
      content.content.forEach(traverse);
    }
    return mentions;
  };

  const handleApprove = async () => {
    if (!ticket || !user) return;

    setLoading(true);
    try {
      // Create approval record
      await supabase.from("approvals").insert([
        {
          ticket_id: ticket.id,
          approved_by: user.id,
          status: "approved",
        },
      ]);

      // Update ticket status
      await supabase.from("tickets").update({ status: "aprovado" }).eq("id", ticket.id);

      // Log activity
      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: user.id,
          action_type: "approved",
        },
      ]);

      // Notify team
      if (ticket.assigned_to) {
        await supabase.from("notifications").insert([
          {
            user_id: ticket.assigned_to,
            type: "approval",
            ticket_id: ticket.id,
          },
        ]);
      }

      toast({ title: "Demanda aprovada!" });
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!ticket || !user || !approvalFeedback) return;

    setLoading(true);
    try {
      // Create approval record with changes requested
      await supabase.from("approvals").insert([
        {
          ticket_id: ticket.id,
          approved_by: user.id,
          status: "changes_requested",
          feedback_json: { text: approvalFeedback },
        },
      ]);

      // Update ticket status back to in progress
      await supabase.from("tickets").update({ status: "em_andamento" }).eq("id", ticket.id);

      // Log activity
      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: user.id,
          action_type: "changes_requested",
          metadata_json: { feedback: approvalFeedback },
        },
      ]);

      // Notify team
      if (ticket.assigned_to) {
        await supabase.from("notifications").insert([
          {
            user_id: ticket.assigned_to,
            type: "changes_requested",
            ticket_id: ticket.id,
          },
        ]);
      }

      toast({ title: "Alterações solicitadas!" });
      setApprovalFeedback("");
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao solicitar alterações", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !user) return;

    setLoading(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "concluido") {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase.from("tickets").update(updateData).eq("id", ticket.id);

      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: user.id,
          action_type: "status_changed",
          metadata_json: { from: ticket.status, to: newStatus },
        },
      ]);

      toast({ title: "Status atualizado!" });
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Previsão de conclusão (due_date). A conclusão real (completed_at) é
  // gravada automaticamente quando o status vira "concluido".
  const handleDueDateChange = async (date: Date | undefined) => {
    if (!ticket) return;
    setLoading(true);
    try {
      const novaData = date ? format(date, "yyyy-MM-dd") : null;
      const { error } = await supabase.from("tickets").update({ due_date: novaData }).eq("id", ticket.id);
      if (error) throw error;
      toast({ title: novaData ? "Previsão de conclusão atualizada!" : "Previsão de conclusão removida" });
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar previsão", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!ticket || !user) return;

    setLoading(true);
    try {
      const newAssigneeId = assigneeId === "unassigned" ? null : assigneeId;

      await supabase.from("tickets").update({ assigned_to: newAssigneeId }).eq("id", ticket.id);

      const assigneeName = teamMembers.find((m) => m.id === assigneeId)?.full_name || "Ninguém";

      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: user.id,
          action_type: "assigned",
          metadata_json: {
            assignee_id: newAssigneeId,
            assignee_name: newAssigneeId ? assigneeName : null,
          },
        },
      ]);

      // Notify assigned user via in-app notification AND email
      if (newAssigneeId && newAssigneeId !== user.id) {
        // In-app notification
        await supabase.from("notifications").insert([
          {
            user_id: newAssigneeId,
            type: "assigned",
            ticket_id: ticket.id,
          },
        ]);

        // Email notification
        await notifyTicketUpdated(
          [newAssigneeId],
          ticket.title,
          `Você foi atribuído como responsável por ${profile?.full_name || "alguém"}`,
        );
      }

      toast({ title: "Responsável atualizado!" });
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao atribuir responsável", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticket || !user) return;

    if (ticket.status !== "novo") {
      toast({
        title: "Não é possível excluir",
        description: 'Somente demandas com status "Novo" podem ser excluídas. Use a opção "Arquivar" em vez disso.',
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
      if (error) throw error;

      toast({ title: "Demanda excluída!" });
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveTicket = async () => {
    if (!ticket || !user) return;

    if (!window.confirm("Tem certeza que deseja arquivar esta demanda?")) {
      return;
    }

    setLoading(true);
    try {
      await supabase.from("tickets").update({ status: "arquivado" }).eq("id", ticket.id);

      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticket.id,
          user_id: user.id,
          action_type: "status_changed",
          metadata_json: { from: ticket.status, to: "arquivado" },
        },
      ]);

      toast({ title: "Demanda arquivada!" });
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao arquivar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // NOVO — copia o link público de acompanhamento desta demanda
  // (atendimento.ncoisas.digital/acompanhar/:token). Todo ticket tem um
  // token_acompanhamento gerado automaticamente pelo banco.
  const handleCopyTrackingLink = async () => {
    if (!ticket?.token_acompanhamento) return;
    const url = `${TRACKING_BASE_URL}/${ticket.token_acompanhamento}`;

    try {
      await navigator.clipboard.writeText(url);
      setTrackingLinkCopied(true);
      toast({
        title: "Link copiado!",
        description: "Envie este link para o cliente acompanhar o status, sem precisar de login.",
      });
      setTimeout(() => setTrackingLinkCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: url,
        variant: "destructive",
      });
    }
  };

  if (!ticket) return null;

  const canChangeStatus = isAdmin || isTeamMember;
  const canApprove = isClient && ticket.status === "aguardando_aprovacao";
  const canDelete = canChangeStatus && ticket.status === "novo";
  const canArchive = canChangeStatus && ticket.status !== "novo" && ticket.status !== "arquivado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col my-8" aria-describedby={undefined}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 pr-8">
            <span className="flex-1 truncate">{ticket.title}</span>
            <Badge className={priorityConfig[ticket.priority].color}>{priorityConfig[ticket.priority].label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Status & Info */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              {canChangeStatus ? (
                <Select value={ticket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig)
                      .filter(([value]) => value !== "arquivado")
                      .map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${config.color}`} />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${statusConfig[ticket.status].color}`} />
                  {statusConfig[ticket.status].label}
                </Badge>
              )}

              {ticket.company && <Badge variant="secondary">{ticket.company.name}</Badge>}

              {ticket.protocolo && (
                <Badge variant="outline" className="font-mono text-xs">
                  {ticket.protocolo}
                </Badge>
              )}

              {/* Previsão de conclusão: editável por equipe/admin */}
              {canChangeStatus ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {ticket.due_date
                        ? `Previsão: ${format(new Date(`${ticket.due_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}`
                        : "Definir previsão"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={ticket.due_date ? new Date(`${ticket.due_date}T00:00:00`) : undefined}
                      onSelect={handleDueDateChange}
                      locale={ptBR}
                      initialFocus
                    />
                    {ticket.due_date && (
                      <div className="border-t p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDueDateChange(undefined)}
                        >
                          Remover previsão
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              ) : (
                ticket.due_date && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Previsão: {format(new Date(`${ticket.due_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                )
              )}

              {/* Conclusão real */}
              {ticket.completed_at && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Concluída em {format(new Date(ticket.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              {/* NOVO — copiar link público de acompanhamento desta demanda */}
              {ticket.token_acompanhamento && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTrackingLink}
                  title="Link de acompanhamento sem login"
                >
                  {trackingLinkCopied ? (
                    <Check className="h-4 w-4 mr-1 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {trackingLinkCopied ? "Copiado!" : "Link de acompanhamento"}
                </Button>
              )}

              {/* Delete/Archive Buttons */}
              {(canDelete || canArchive) && (
                <>
                  {canDelete && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteTicket} disabled={loading}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  )}
                  {canArchive && (
                    <Button variant="outline" size="sm" onClick={handleArchiveTicket} disabled={loading}>
                      <Archive className="h-4 w-4 mr-1" />
                      Arquivar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Assignee Selection */}
          {canChangeStatus ? (
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Responsável:</span>
              <Select value={ticket.assigned_to || "unassigned"} onValueChange={handleAssigneeChange}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Selecione responsável">
                    {ticket.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{ticket.assignee.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{ticket.assignee.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Não atribuído</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <span className="text-muted-foreground">Não atribuído</span>
                  </SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{member.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{member.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : ticket.assignee ? (
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Responsável:</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                  <AvatarFallback>{ticket.assignee.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{ticket.assignee.full_name}</span>
              </div>
            </div>
          ) : null}

          {/* Description */}
          {ticket.description_json && (
            <div className="border rounded-md p-4 bg-muted/30">
              <TipTapEditor content={ticket.description_json} editable={false} />
            </div>
          )}

          {/* Checklist */}
          <TicketChecklist ticketId={ticket.id} />

          <Separator />

          {/* Linked Demands */}
          <TicketLinks ticketId={ticket.id} companyId={ticket.company_id} />

          <Separator />

          {/* Attachments */}
          <TicketAttachments ticketId={ticket.id} companyId={ticket.company_id} />

          {/* Approval Items Panel - for art approvals */}
          {(ticket.requires_approval || ticket.status === "aguardando_aprovacao") && (
            <>
              <Separator />
              <ApprovalItemsPanel ticketId={ticket.id} canAddItems={isAdmin || isTeamMember} canReview={isClient} />
            </>
          )}

          <Separator />

          {/* Approval Section */}
          {canApprove && (
            <div className="border rounded-md p-4 bg-yellow-50 dark:bg-yellow-900/20 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aguardando sua aprovação
              </h4>
              <div className="flex gap-2">
                <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
                <Button variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                  <X className="h-4 w-4 mr-2" />
                  Solicitar Alteração
                </Button>
              </div>
              <Textarea
                placeholder="Descreva as alterações necessárias..."
                value={approvalFeedback}
                onChange={(e) => setApprovalFeedback(e.target.value)}
              />
              {approvalFeedback && (
                <Button onClick={handleRequestChanges} disabled={loading} variant="outline">
                  Enviar Feedback
                </Button>
              )}
            </div>
          )}

          <Separator />

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Histórico
            </h4>

            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.user?.avatar_url || undefined} />
                    <AvatarFallback>{item.user?.full_name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{item.user?.full_name || "Sistema"}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {item.type === "comment" && (
                      <div className="border rounded-md p-3 bg-card">
                        <TipTapEditor content={(item as any).content_json} editable={false} />
                      </div>
                    )}

                    {item.type === "activity" && (
                      <p className="text-sm text-muted-foreground">
                        {item.action_type === "status_changed" && (
                          <>
                            Mudou status de <Badge variant="outline">{item.metadata_json?.from}</Badge> para{" "}
                            <Badge variant="outline">{item.metadata_json?.to}</Badge>
                          </>
                        )}
                        {item.action_type === "approved" && "Aprovou a demanda"}
                        {item.action_type === "changes_requested" &&
                          `Solicitou alterações: ${item.metadata_json?.feedback}`}
                        {item.action_type === "assigned" &&
                          (item.metadata_json?.assignee_name ? (
                            <>
                              Atribuiu a demanda para{" "}
                              <Badge variant="outline">{item.metadata_json.assignee_name}</Badge>
                            </>
                          ) : (
                            "Removeu a atribuição da demanda"
                          ))}
                      </p>
                    )}

                    {item.type === "approval" && (
                      <div
                        className={`text-sm p-2 rounded ${
                          item.status === "approved" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {item.status === "approved"
                          ? "✓ Aprovado"
                          : `⚠ Alterações solicitadas: ${item.feedback_json?.text || ""}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade ainda</p>
              )}
            </div>
          </div>

          <Separator />

          {/* New Comment */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Novo Comentário
            </h4>
            <TipTapEditor
              content={newComment}
              onChange={setNewComment}
              placeholder="Escreva um comentário... Use @nome para mencionar"
            />
            <div className="flex justify-end">
              <Button onClick={handleAddComment} disabled={loading || !newComment}>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
