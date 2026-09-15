import { supabase } from '@/integrations/supabase/client';

interface EmailData {
  ticket_id?: string;
  ticket_title?: string;
  company_id?: string;
  company_name?: string;
  user_name?: string;
  message?: string;
  action_url?: string;
  recipient_user_ids?: string[];
}

type EmailTemplate = 'ticket_created' | 'ticket_updated' | 'ticket_approved' | 'ticket_rejected' | 'mention' | 'custom';

export const useEmailNotifications = () => {
  const sendEmailToUsers = async (
    userIds: string[],
    template: EmailTemplate,
    data?: EmailData,
    subject?: string
  ) => {
    try {
      // Call edge function with user IDs - it will resolve emails server-side
      const { data: response, error } = await supabase.functions.invoke('send-email', {
        body: {
          recipient_user_ids: userIds,
          template,
          subject,
          data: {
            ...data,
            action_url: data?.action_url || `${window.location.origin}/kanban`,
          },
        },
      });

      if (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
      }

      console.log('Email notification queued:', response);
      return { success: true, data: response };
    } catch (err) {
      console.error('Error invoking send-email function:', err);
      return { success: false, error: err };
    }
  };

  const notifyTicketCreated = async (
    companyId: string,
    ticketTitle: string,
    companyName: string,
    creatorName: string
  ) => {
    // Get team members for this company
    const userIds = await getTeamMembersForCompany(companyId);
    if (userIds.length === 0) return;

    await sendEmailToUsers(userIds, 'ticket_created', {
      ticket_title: ticketTitle,
      company_name: companyName,
      user_name: creatorName,
    });
  };

  const notifyTicketUpdated = async (
    userIds: string[],
    ticketTitle: string,
    message: string
  ) => {
    if (userIds.length === 0) return;

    await sendEmailToUsers(userIds, 'ticket_updated', {
      ticket_title: ticketTitle,
      message,
    });
  };

  const notifyTicketApproved = async (
    userIds: string[],
    ticketTitle: string,
    feedback?: string
  ) => {
    if (userIds.length === 0) return;

    await sendEmailToUsers(userIds, 'ticket_approved', {
      ticket_title: ticketTitle,
      message: feedback,
    });
  };

  const notifyTicketRejected = async (
    userIds: string[],
    ticketTitle: string,
    feedback: string
  ) => {
    if (userIds.length === 0) return;

    await sendEmailToUsers(userIds, 'ticket_rejected', {
      ticket_title: ticketTitle,
      message: feedback,
    });
  };

  const notifyMention = async (
    userId: string,
    ticketTitle: string,
    mentionedByName: string,
    commentPreview: string
  ) => {
    await sendEmailToUsers([userId], 'mention', {
      ticket_title: ticketTitle,
      user_name: mentionedByName,
      message: commentPreview,
    });
  };

  // Envia para endereços de e-mail diretos (solicitantes sem login no sistema)
  const sendEmailToAddresses = async (
    emails: string[],
    template: EmailTemplate,
    data?: EmailData,
    subject?: string
  ) => {
    const to = emails.filter(Boolean);
    if (to.length === 0) return { success: false };
    try {
      const { data: response, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          template,
          subject,
          data: {
            ...data,
            action_url: data?.action_url || `${window.location.origin}/kanban`,
          },
        },
      });
      if (error) {
        console.error('Error sending email to addresses:', error);
        return { success: false, error };
      }
      return { success: true, data: response };
    } catch (err) {
      console.error('Error invoking send-email function:', err);
      return { success: false, error: err };
    }
  };

  // Notifica o solicitante (pessoa cadastrada na abertura da demanda) com o
  // link público de acompanhamento, sem exigir login.
  const notifySolicitante = async (
    email: string | null | undefined,
    ticketTitle: string,
    message: string,
    solicitanteNome?: string | null,
    trackingToken?: string | null
  ) => {
    if (!email) return;
    await sendEmailToAddresses([email], 'ticket_updated', {
      ticket_title: ticketTitle,
      message,
      user_name: solicitanteNome || 'Solicitante',
      action_url: trackingToken
        ? `https://atendimento.ncoisas.digital/acompanhar/${trackingToken}`
        : undefined,
    });
  };

  const getTeamMembersForCompany = async (companyId: string): Promise<string[]> => {
    try {
      const { data: teamClients } = await supabase
        .from('team_clients')
        .select('team_id')
        .eq('company_id', companyId);

      if (!teamClients || teamClients.length === 0) return [];

      const teamIds = teamClients.map(tc => tc.team_id);

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', teamIds);

      if (!teamMembers || teamMembers.length === 0) return [];

      return teamMembers.map(tm => tm.user_id);
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  };

  return {
    sendEmailToUsers,
    sendEmailToAddresses,
    notifySolicitante,
    notifyTicketCreated,
    notifyTicketUpdated,
    notifyTicketApproved,
    notifyTicketRejected,
    notifyMention,
    getTeamMembersForCompany,
  };
};
