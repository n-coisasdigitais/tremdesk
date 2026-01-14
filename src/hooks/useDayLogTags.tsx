import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DayLogTag {
  id: string;
  name: string;
  bg_color: string;
  text_color: string;
  active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface DayLogTagFormData {
  name: string;
  bg_color: string;
  text_color: string;
  active?: boolean;
}

export const useDayLogTags = () => {
  const [tags, setTags] = useState<DayLogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTags = async (includeInactive = false) => {
    setLoading(true);
    try {
      let query = supabase
        .from('daylog_tags')
        .select('*')
        .order('name');
      
      if (!includeInactive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching daylog tags:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as tags.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTag = async (formData: DayLogTagFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('daylog_tags')
        .insert({
          name: formData.name,
          bg_color: formData.bg_color,
          text_color: formData.text_color,
          active: formData.active ?? true,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Tag criada com sucesso.',
      });

      await fetchTags(true);
      return data;
    } catch (error: any) {
      console.error('Error creating tag:', error);
      toast({
        title: 'Erro',
        description: error.message?.includes('unique') 
          ? 'Já existe uma tag com esse nome.'
          : 'Não foi possível criar a tag.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateTag = async (id: string, formData: Partial<DayLogTagFormData>) => {
    try {
      const { error } = await supabase
        .from('daylog_tags')
        .update(formData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Tag atualizada com sucesso.',
      });

      await fetchTags(true);
      return true;
    } catch (error: any) {
      console.error('Error updating tag:', error);
      toast({
        title: 'Erro',
        description: error.message?.includes('unique') 
          ? 'Já existe uma tag com esse nome.'
          : 'Não foi possível atualizar a tag.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase
        .from('daylog_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Tag excluída com sucesso.',
      });

      await fetchTags(true);
      return true;
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a tag.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleTagActive = async (id: string, active: boolean) => {
    return updateTag(id, { active });
  };

  const getTagColors = (tagName: string): { bg: string; text: string } => {
    const tag = tags.find(t => t.name === tagName);
    if (tag) {
      return { bg: tag.bg_color, text: tag.text_color };
    }
    // Fallback for tags not found
    return { bg: '#f3f4f6', text: '#374151' };
  };

  useEffect(() => {
    fetchTags();
  }, []);

  return {
    tags,
    loading,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    toggleTagActive,
    getTagColors,
  };
};
