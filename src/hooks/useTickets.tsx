import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, TicketStatus } from "@/types";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useEmailNotifications } from "./useEmailNotifications";

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { notifyTicketCreated, notifyTicketUpdated, notifyTicketApproved, notifyTicketRejected, notifyMention } =
    useEmailNotifications();

  // Extract mentions from TipTap JSON content
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
    return [...new Set(mentions)]; // Remove duplicates
  };

  // Extract text preview from TipTap JSON content
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

  useEffect(() => {
    if (!user) return;

    fetchTickets();

    // Nome único por instância evita reaproveitar um canal já inscrito.
    // Em dev o React StrictMode monta o efeito 2x e removeChannel é assíncrono,
    // então um nome fixo faria a 2ª montagem pegar o canal ainda-inscrito e
    // quebrar com "cannot add postgres_changes callbacks ... after subscribe()".
    const channel = supabase
      .channel(`tickets_changes_${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => {
          fetchTickets();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          *,
          company:companies(*),
          creator:profiles!tickets_created_by_fkey(*),
          assignee:profiles!tickets_assigned_to_fkey(*)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({
        title: "Erro ao carregar demandas",
        description: "Não foi possível carregar as demandas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData: any) => {
    // Optimistic update - create temporary ticket immediately
    const tempId = `temp-${Date.now()}`;
    const tempTicket: Ticket = {
      id: tempId,
      title: ticketData.title,
      description_json: ticketData.description_json,
      category: ticketData.category,
      priority: ticketData.priority || "media",
      status: "novo",
      company_id: ticketData.company_id,
      created_by: user?.id || "",
      assigned_to: ticketData.assigned_to,
      due_date: ticketData.due_date,
      requires_approval: ticketData.requires_approval || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      company: null,
      creator: profile || null,
      assignee: null,
    };

    // Immediately add to state
    setTickets((prev) => [tempTicket, ...prev]);

    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert([
          {
            ...ticketData,
            created_by: user?.id,
          },
        ])
        .select(
          `
          *,
          company:companies(*)
        `,
        )
        .single();

      if (error) {
        // Revert optimistic update on error
        setTickets((prev) => prev.filter((t) => t.id !== tempId));
        throw error;
      }

      // Replace temp ticket with real one
      setTickets((prev) =>
        prev.map((t) => (t.id === tempId ? ({ ...data, creator: profile, assignee: null } as Ticket) : t)),
      );

      toast({
        title: "Demanda criada!",
        description: "A demanda foi criada com sucesso.",
      });

      // Background tasks (non-blocking)
      if (data) {
        // Create Google Drive folder (optional - only if configured)
        supabase.functions
          .invoke("google-drive-folders", {
            body: {
              action: "create_demand_folder",
              demand_id: data.id,
              demand_title: data.title,
              company_id: data.company_id,
            },
          })
          .then((response) => {
            if (response.error) {
              // Check if it's a configuration error (expected if not configured)
              console.log("Google Drive integration not configured or error:", response.error);
              return;
            }
            if (response.data?.error) {
              console.log("Google Drive integration not configured:", response.data.error);
              return;
            }
            if (response.data?.folder_url) {
              console.log("Google Drive folder created:", response.data.folder_url);
            }
          })
          .catch((err) => {
            // Silently ignore - Google Drive is optional
            console.log("Google Drive folder creation skipped:", err?.message || "not configured");
          });

        // Send email notifications to team members assigned to this company
        notifyTicketCreated(
          data.company_id,
          data.title,
          data.company?.name || "Empresa",
          profile?.full_name || "Usuário",
        ).catch((err) => {
          console.log("Email notification skipped or failed:", err);
        });

        // Notify assigned user if ticket was created with an assignee
        if (ticketData.assigned_to) {
          // Create in-app notification (even for self-assignment for consistency)
          supabase
            .from("notifications")
            .insert([
              {
                user_id: ticketData.assigned_to,
                type: "assigned",
                ticket_id: data.id,
              },
            ])
            .then(({ error }) => {
              if (error) console.error("Error creating notification:", error);
              else console.log("In-app notification created for assignee");
            });

          // Send email notification only if assigning to someone else
          if (ticketData.assigned_to !== user?.id) {
            notifyTicketUpdated(
              [ticketData.assigned_to],
              data.title,
              `Você foi atribuído como responsável por ${profile?.full_name || "alguém"}`,
            )
              .then((result) => {
                console.log("Email notification result for assignee:", result);
              })
              .catch((err) => {
                console.log("Email notification for assignee skipped or failed:", err);
              });
          }
        }

        // Process mentions in ticket description
        if (ticketData.description_json) {
          const mentions = extractMentions(ticketData.description_json);
          const descriptionPreview = extractTextPreview(ticketData.description_json);

          for (const mentionedUserId of mentions) {
            // Skip notifying yourself
            if (mentionedUserId === user?.id) continue;

            // Create mention record
            supabase
              .from("mentions")
              .insert([
                {
                  ticket_id: data.id,
                  mentioned_user_id: mentionedUserId,
                  mentioned_by: user?.id,
                },
              ])
              .then(({ error }) => {
                if (error) console.error("Error creating mention:", error);
              });

            // Create in-app notification
            supabase
              .from("notifications")
              .insert([
                {
                  user_id: mentionedUserId,
                  type: "mention",
                  ticket_id: data.id,
                },
              ])
              .then(({ error }) => {
                if (error) console.error("Error creating notification:", error);
                else console.log("In-app notification created for mention");
              });

            // Send email notification
            notifyMention(mentionedUserId, data.title, profile?.full_name || "Alguém", descriptionPreview).then(
              (result) => {
                console.log("Email notification result for mention:", result);
              },
            );
          }
        }
      }

      await fetchTickets();
      return { data, error: null };
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast({
        title: "Erro ao criar demanda",
        description: error.message,
        variant: "destructive",
      });
      return { data: null, error };
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus, feedback?: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    const oldStatus = ticket?.status;

    // Optimistic update - immediately update local state
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));

    try {
      const updateData: any = { status: newStatus };

      if (newStatus === "concluido") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("tickets").update(updateData).eq("id", ticketId);

      if (error) throw error;

      // Log activity
      await supabase.from("ticket_activities").insert([
        {
          ticket_id: ticketId,
          user_id: user?.id,
          action_type: "status_changed",
          metadata_json: { from: oldStatus, to: newStatus },
        },
      ]);

      toast({
        title: "Status atualizado",
        description: "O status da demanda foi atualizado.",
      });

      // Send email notifications based on status change
      if (ticket) {
        sendStatusChangeNotification(ticket, oldStatus, newStatus, feedback);
      }

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      // Revert optimistic update on error
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: oldStatus as TicketStatus } : t)));

      // DIAGNÓSTICO — log completo do erro do Postgres (code/details/hint),
      // não só a mensagem. É o que precisamos ver no console pra fechar a
      // causa raiz do bug de mover card entre etapas (RLS, sessão expirada,
      // etc.) em segundos, na próxima vez que acontecer.
      console.error("Error updating ticket status:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const sendStatusChangeNotification = async (
    ticket: Ticket,
    oldStatus: string | undefined,
    newStatus: TicketStatus,
    feedback?: string,
  ) => {
    try {
      // Collect user IDs to notify
      const userIds: string[] = [];

      if (ticket.creator?.id) {
        userIds.push(ticket.creator.id);
      }
      if (ticket.assignee?.id && !userIds.includes(ticket.assignee.id)) {
        userIds.push(ticket.assignee.id);
      }

      if (userIds.length === 0) return;

      // Determine which notification to send based on status
      if (newStatus === "aprovado") {
        await notifyTicketApproved(userIds, ticket.title, feedback);
      } else if (oldStatus === "aguardando_aprovacao") {
        // Changes requested (coming from aguardando_aprovacao to any other status except aprovado)
        await notifyTicketRejected(userIds, ticket.title, feedback || "Alterações solicitadas");
      } else {
        // Generic status update
        const statusLabels: Record<string, string> = {
          novo: "Novo",
          em_andamento: "Em Andamento",
          aguardando_aprovacao: "Aguardando Aprovação",
          aprovado: "Aprovado",
          concluido: "Concluído",
          cancelado: "Cancelado",
        };
        const message = `Status alterado para: ${statusLabels[newStatus] || newStatus}`;
        await notifyTicketUpdated(userIds, ticket.title, message);
      }
    } catch (error) {
      console.error("Error sending status change notification:", error);
    }
  };

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      // Remove relation fields (not real columns) before sending to the database
      const { company, creator, assignee, categories, watchers, ...columns } = updates;

      const { error } = await supabase.from("tickets").update(columns).eq("id", ticketId);

      if (error) throw error;

      toast({
        title: "Demanda atualizada",
        description: "A demanda foi atualizada com sucesso.",
      });

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      console.error("Error updating ticket:", error);
      toast({
        title: "Erro ao atualizar demanda",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const deleteTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase.from("tickets").delete().eq("id", ticketId);

      if (error) throw error;

      toast({
        title: "Demanda excluída",
        description: "A demanda foi excluída com sucesso.",
      });

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      toast({
        title: "Erro ao excluir demanda",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  return {
    tickets,
    loading,
    fetchTickets,
    createTicket,
    updateTicketStatus,
    updateTicket,
    deleteTicket,
  };
};
