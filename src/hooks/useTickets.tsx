import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, TicketStatus } from '@/types';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const useTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchTickets();
      
      // Setup realtime subscription
      const channel = supabase
        .channel('tickets_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets'
          },
          () => {
            fetchTickets();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          company:companies(*),
          creator:profiles!tickets_created_by_fkey(*),
          assignee:profiles!tickets_assigned_to_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: 'Erro ao carregar demandas',
        description: 'Não foi possível carregar as demandas.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData: any) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert([{
          ...ticketData,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Demanda criada!',
        description: 'A demanda foi criada com sucesso.'
      });

      // Create Google Drive folder in background (non-blocking)
      if (data) {
        supabase.functions.invoke('google-drive-folders', {
          body: {
            action: 'create_demand_folder',
            demand_id: data.id,
            demand_title: data.title,
            company_id: data.company_id,
          },
        }).then(response => {
          if (response.data?.folder_url) {
            console.log('Google Drive folder created:', response.data.folder_url);
          }
        }).catch(err => {
          console.log('Google Drive folder creation skipped or failed:', err.message);
        });
      }

      await fetchTickets();
      return { data, error: null };
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast({
        title: 'Erro ao criar demanda',
        description: error.message,
        variant: 'destructive'
      });
      return { data: null, error };
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'concluido') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert([{
        ticket_id: ticketId,
        user_id: user?.id,
        action_type: 'status_changed',
        metadata_json: { from: tickets.find(t => t.id === ticketId)?.status, to: newStatus }
      }]);

      toast({
        title: 'Status atualizado',
        description: 'O status da demanda foi atualizado.'
      });

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive'
      });
      return { error };
    }
  };

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Demanda atualizada',
        description: 'A demanda foi atualizada com sucesso.'
      });

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      toast({
        title: 'Erro ao atualizar demanda',
        description: error.message,
        variant: 'destructive'
      });
      return { error };
    }
  };

  const deleteTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Demanda excluída',
        description: 'A demanda foi excluída com sucesso.'
      });

      await fetchTickets();
      return { error: null };
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      toast({
        title: 'Erro ao excluir demanda',
        description: error.message,
        variant: 'destructive'
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
    deleteTicket
  };
};
