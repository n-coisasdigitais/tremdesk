import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DayLog {
  id: string;
  date: string;
  user_id: string;
  company_id: string | null;
  description: string | null;
  work_done: string;
  work_pending: string | null;
  next_steps: string | null;
  tags: string[];
  transcription_url: string | null;
  ai_assistant_url: string | null;
  meeting_notes: string | null;
  google_doc_id: string | null;
  google_doc_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  company?: {
    id: string;
    name: string;
  };
}

export interface DayLogAttachment {
  id: string;
  day_log_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  google_drive_file_id: string | null;
  google_drive_folder_id: string | null;
  created_at: string;
}

export interface DayLogFormData {
  date: string;
  description?: string;
  work_done: string;
  work_pending?: string;
  next_steps?: string;
  tags: string[];
  transcription_url?: string;
  ai_assistant_url?: string;
  meeting_notes?: string;
  company_id?: string;
}

export const DAYLOG_TAGS = [
  'Google',
  'Meta Ads',
  'LinkedIn',
  'Criativos',
  'Conteúdo',
  'Relatórios',
  'CRM',
  'Técnico',
  'Cliente',
  'Reunião',
  'Estratégia',
] as const;

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Google': { bg: 'bg-red-100', text: 'text-red-700' },
  'Meta Ads': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'LinkedIn': { bg: 'bg-sky-100', text: 'text-sky-700' },
  'Criativos': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Conteúdo': { bg: 'bg-green-100', text: 'text-green-700' },
  'Relatórios': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'CRM': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Técnico': { bg: 'bg-gray-100', text: 'text-gray-700' },
  'Cliente': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  'Reunião': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Estratégia': { bg: 'bg-pink-100', text: 'text-pink-700' },
};

export const useDayLogs = () => {
  const [dayLogs, setDayLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchDayLogs = async (filters?: {
    date?: string;
    userId?: string;
    tags?: string[];
    companyId?: string;
  }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('day_logs')
        .select('*, company:companies(id, name)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.date) {
        query = query.eq('date', filters.date);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }
      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(d => d.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const logsWithProfiles = data.map(log => ({
          ...log,
          profiles: profilesMap.get(log.user_id) || null
        }));
        
        setDayLogs(logsWithProfiles as DayLog[]);
      } else {
        setDayLogs([]);
      }
    } catch (error) {
      console.error('Error fetching day logs:', error);
      toast.error('Erro ao carregar DayLogs');
    } finally {
      setLoading(false);
    }
  };

  const createDayLog = async (formData: DayLogFormData) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('day_logs')
        .insert({
          user_id: user.id,
          date: formData.date,
          description: formData.description || null,
          work_done: formData.work_done,
          work_pending: formData.work_pending || null,
          next_steps: formData.next_steps || null,
          tags: formData.tags,
          transcription_url: formData.transcription_url || null,
          ai_assistant_url: formData.ai_assistant_url || null,
          meeting_notes: formData.meeting_notes || null,
          company_id: formData.company_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('DayLog criado com sucesso!');
      return data;
    } catch (error) {
      console.error('Error creating day log:', error);
      toast.error('Erro ao criar DayLog');
      return null;
    }
  };

  const updateDayLog = async (id: string, formData: Partial<DayLogFormData>) => {
    try {
      const { data, error } = await supabase
        .from('day_logs')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('DayLog atualizado com sucesso!');
      return data;
    } catch (error) {
      console.error('Error updating day log:', error);
      toast.error('Erro ao atualizar DayLog');
      return null;
    }
  };

  const deleteDayLog = async (id: string) => {
    try {
      const { error } = await supabase
        .from('day_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('DayLog excluído com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting day log:', error);
      toast.error('Erro ao excluir DayLog');
      return false;
    }
  };

  const getDayLogById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('day_logs')
        .select('*, company:companies(id, name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Fetch profile separately
      if (data) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', data.user_id)
          .single();
        
        return {
          ...data,
          profiles: profileData || null
        } as DayLog;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching day log:', error);
      toast.error('Erro ao carregar DayLog');
      return null;
    }
  };

  // Fetch attachments for a day log
  const getAttachments = async (dayLogId: string) => {
    try {
      const { data, error } = await supabase
        .from('day_log_attachments')
        .select('*')
        .eq('day_log_id', dayLogId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DayLogAttachment[];
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  };

  // Upload attachment
  const uploadAttachment = async (dayLogId: string, file: File) => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${dayLogId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('day_log_attachments')
        .insert({
          day_log_id: dayLogId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Arquivo anexado com sucesso!');
      return data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast.error('Erro ao anexar arquivo');
      return null;
    }
  };

  // Delete attachment
  const deleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('day_log_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
      toast.success('Anexo removido com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Erro ao remover anexo');
      return false;
    }
  };

  useEffect(() => {
    fetchDayLogs();
  }, []);

  return {
    dayLogs,
    loading,
    fetchDayLogs,
    createDayLog,
    updateDayLog,
    deleteDayLog,
    getDayLogById,
    getAttachments,
    uploadAttachment,
    deleteAttachment,
  };
};
