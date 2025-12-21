import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ApprovalItem, ApprovalItemIssue, ApprovalItemStatus } from '@/types';
import { toast } from '@/hooks/use-toast';

export const useApprovalItems = (ticketId?: string) => {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!ticketId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('approval_items')
        .select(`
          *,
          reviewer:profiles!approval_items_reviewed_by_fkey(*)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch issues for each item
      const itemsWithIssues = await Promise.all(
        (data || []).map(async (item) => {
          const { data: issues } = await supabase
            .from('approval_item_issues')
            .select('*, resolver:profiles!approval_item_issues_resolved_by_fkey(*)')
            .eq('approval_item_id', item.id)
            .order('created_at', { ascending: true });

          return {
            ...item,
            issues: issues || [],
          } as ApprovalItem;
        })
      );

      setItems(itemsWithIssues);
    } catch (error: any) {
      console.error('Erro ao buscar itens de aprovação:', error);
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (data: {
    title: string;
    description?: string;
    file_url?: string;
  }) => {
    if (!ticketId) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: item, error } = await supabase
        .from('approval_items')
        .insert({
          ticket_id: ticketId,
          title: data.title,
          description: data.description,
          file_url: data.file_url,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'approval_item_created',
        metadata_json: { item_id: item.id, title: data.title },
      });

      toast({
        title: 'Item de aprovação criado',
        description: `O item "${data.title}" foi adicionado para aprovação.`,
      });

      fetchItems();
      return item;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar item de aprovação',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateItemStatus = async (
    itemId: string,
    status: ApprovalItemStatus,
    feedback?: string
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('approval_items')
        .update({
          status,
          feedback,
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      // Log activity
      const item = items.find(i => i.id === itemId);
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'approval_item_status_changed',
        metadata_json: { item_id: itemId, status, title: item?.title },
      });

      const statusLabels = {
        pending: 'Pendente',
        approved: 'Aprovado',
        changes_requested: 'Alterações solicitadas',
      };

      toast({
        title: 'Status atualizado',
        description: `O item foi marcado como "${statusLabels[status]}".`,
      });

      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const item = items.find(i => i.id === itemId);

      const { error } = await supabase
        .from('approval_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'approval_item_deleted',
        metadata_json: { item_id: itemId, title: item?.title },
      });

      toast({
        title: 'Item excluído',
        description: 'O item de aprovação foi excluído.',
      });

      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir item',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createIssue = async (itemId: string, description: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('approval_item_issues')
        .insert({
          approval_item_id: itemId,
          description,
          created_by: userData.user?.id,
        });

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'approval_issue_created',
        metadata_json: { item_id: itemId, description },
      });

      toast({
        title: 'Pendência adicionada',
        description: 'A pendência foi adicionada ao item de aprovação.',
      });

      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar pendência',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resolveIssue = async (issueId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('approval_item_issues')
        .update({
          status: 'resolved',
          resolved_by: userData.user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', issueId);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticketId,
        user_id: userData.user?.id,
        action_type: 'approval_issue_resolved',
        metadata_json: { issue_id: issueId },
      });

      toast({
        title: 'Pendência resolvida',
        description: 'A pendência foi marcada como resolvida.',
      });

      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao resolver pendência',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchItems();

    if (!ticketId) return;

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`approval_items_${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approval_items', filter: `ticket_id=eq.${ticketId}` },
        () => {
          fetchItems();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approval_item_issues' },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return {
    items,
    loading,
    fetchItems,
    createItem,
    updateItemStatus,
    deleteItem,
    createIssue,
    resolveIssue,
  };
};
