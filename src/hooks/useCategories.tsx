import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TicketCategoryItem } from '@/types';
import { toast } from '@/hooks/use-toast';

export const useCategories = () => {
  const [categories, setCategories] = useState<TicketCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_categories')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Erro ao carregar categorias:', error);
        throw error;
      }
      console.log('Categorias carregadas:', data);
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar categorias',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (category: {
    name: string;
    icon?: string;
    color?: string;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('ticket_categories')
        .insert({
          name: category.name,
          icon: category.icon || '📋',
          color: category.color || '#6366f1',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data]);
      toast({
        title: 'Categoria criada',
        description: `A categoria "${category.name}" foi criada com sucesso.`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar categoria',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateCategory = async (
    id: string,
    updates: Partial<{ name: string; icon: string; color: string; active: boolean }>
  ) => {
    try {
      const { error } = await supabase
        .from('ticket_categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setCategories(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates } : c))
      );

      toast({
        title: 'Categoria atualizada',
        description: 'A categoria foi atualizada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar categoria',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ticket_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Categoria excluída',
        description: 'A categoria foi excluída com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir categoria',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTicketCategories = async (ticketId: string): Promise<TicketCategoryItem[]> => {
    try {
      const { data, error } = await supabase
        .from('ticket_category_assignments')
        .select('category_id, ticket_categories(*)')
        .eq('ticket_id', ticketId);

      if (error) throw error;

      return data?.map(d => d.ticket_categories as unknown as TicketCategoryItem) || [];
    } catch (error: any) {
      console.error('Erro ao buscar categorias do ticket:', error);
      return [];
    }
  };

  const assignCategories = async (ticketId: string, categoryIds: string[]) => {
    try {
      // First remove existing assignments
      const { error: deleteError } = await supabase
        .from('ticket_category_assignments')
        .delete()
        .eq('ticket_id', ticketId);

      if (deleteError) throw deleteError;

      // Then insert new assignments
      if (categoryIds.length > 0) {
        const { error: insertError } = await supabase
          .from('ticket_category_assignments')
          .insert(
            categoryIds.map(categoryId => ({
              ticket_id: ticketId,
              category_id: categoryId,
            }))
          );

        if (insertError) throw insertError;
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao atribuir categorias',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchCategories();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('ticket_categories_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_categories' },
        () => {
          fetchCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getTicketCategories,
    assignCategories,
  };
};
