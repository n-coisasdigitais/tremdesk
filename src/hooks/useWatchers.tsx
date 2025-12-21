import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TicketWatcher, Profile } from '@/types';
import { toast } from '@/hooks/use-toast';

export const useWatchers = () => {
  const [loading, setLoading] = useState(false);

  const getTicketWatchers = async (ticketId: string): Promise<TicketWatcher[]> => {
    try {
      const { data, error } = await supabase
        .from('ticket_watchers')
        .select('*, user:profiles(*)')
        .eq('ticket_id', ticketId);

      if (error) throw error;

      return data?.map(w => ({
        ...w,
        user: w.user as unknown as Profile,
      })) || [];
    } catch (error: any) {
      console.error('Erro ao buscar watchers:', error);
      return [];
    }
  };

  const addWatcher = async (ticketId: string, userId: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ticket_watchers')
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          added_by: userData.user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Usuário já é observador',
            description: 'Este usuário já está acompanhando este ticket.',
            variant: 'destructive',
          });
          return false;
        }
        throw error;
      }

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'watcher_added',
        metadata_json: { watcher_id: userId },
      });

      toast({
        title: 'Observador adicionado',
        description: 'O usuário foi adicionado como observador do ticket.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar observador',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeWatcher = async (ticketId: string, userId: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ticket_watchers')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('user_id', userId);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'watcher_removed',
        metadata_json: { watcher_id: userId },
      });

      toast({
        title: 'Observador removido',
        description: 'O usuário foi removido da lista de observadores.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao remover observador',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getTicketWatchers,
    addWatcher,
    removeWatcher,
  };
};
