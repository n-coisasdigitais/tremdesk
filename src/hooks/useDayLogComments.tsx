import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface DayLogComment {
  id: string;
  day_log_id: string;
  user_id: string | null;
  content_json: Json;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  replies?: DayLogComment[];
}

export function useDayLogComments() {
  const [comments, setComments] = useState<DayLogComment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchComments = useCallback(async (dayLogId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daylog_comments')
        .select('*')
        .eq('day_log_id', dayLogId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set((data || []).map(c => c.user_id).filter(Boolean))] as string[];
      let profilesMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      }

      // Organize comments into threads
      const commentsMap = new Map<string, DayLogComment>();
      const topLevelComments: DayLogComment[] = [];

      // First pass: create map of all comments with profiles
      (data || []).forEach(comment => {
        const commentWithProfile: DayLogComment = {
          ...comment,
          profiles: comment.user_id ? profilesMap[comment.user_id] || null : null,
          replies: [],
        };
        commentsMap.set(comment.id, commentWithProfile);
      });

      // Second pass: organize into parent-child structure
      (data || []).forEach(comment => {
        const commentWithReplies = commentsMap.get(comment.id)!;
        if (comment.parent_comment_id) {
          const parent = commentsMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(commentWithReplies);
          } else {
            topLevelComments.push(commentWithReplies);
          }
        } else {
          topLevelComments.push(commentWithReplies);
        }
      });

      setComments(topLevelComments);
      return topLevelComments;
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os comentários.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addComment = useCallback(async (
    dayLogId: string,
    contentJson: Json,
    parentCommentId?: string
  ): Promise<DayLogComment | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('daylog_comments')
        .insert({
          day_log_id: dayLogId,
          user_id: user.id,
          content_json: contentJson,
          parent_comment_id: parentCommentId || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Fetch profile for the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .single();

      toast({
        title: 'Comentário adicionado',
        description: 'Seu comentário foi publicado.',
      });

      return { ...data, profiles: profile, replies: [] } as DayLogComment;
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o comentário.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const updateComment = useCallback(async (
    commentId: string,
    contentJson: Json
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('daylog_comments')
        .update({ content_json: contentJson })
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: 'Comentário atualizado',
        description: 'Seu comentário foi editado.',
      });

      return true;
    } catch (error: any) {
      console.error('Error updating comment:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o comentário.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('daylog_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: 'Comentário excluído',
        description: 'O comentário foi removido.',
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o comentário.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const getCommentCount = useCallback(async (dayLogId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('daylog_comments')
        .select('*', { count: 'exact', head: true })
        .eq('day_log_id', dayLogId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }
  }, []);

  return {
    comments,
    loading,
    fetchComments,
    addComment,
    updateComment,
    deleteComment,
    getCommentCount,
  };
}
