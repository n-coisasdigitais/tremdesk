import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DayLogEmailSend {
  id: string;
  day_log_id: string;
  sent_by: string | null;
  sent_at: string;
  sent_to: string[];
  subject: string | null;
  sender_profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export const useDayLogEmailHistory = (dayLogId: string) => {
  const [emailHistory, setEmailHistory] = useState<DayLogEmailSend[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEmailHistory = useCallback(async () => {
    if (!dayLogId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daylog_email_sends')
        .select('*')
        .eq('day_log_id', dayLogId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set(data?.map(d => d.sent_by).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          return acc;
        }, {} as Record<string, { full_name: string; avatar_url: string | null }>);
      }

      const enrichedData = (data || []).map(send => ({
        ...send,
        sender_profile: send.sent_by ? profilesMap[send.sent_by] : undefined,
      }));

      setEmailHistory(enrichedData);
    } catch (error) {
      console.error('Error fetching email history:', error);
      setEmailHistory([]);
    } finally {
      setLoading(false);
    }
  }, [dayLogId]);

  return {
    emailHistory,
    loading,
    fetchEmailHistory,
  };
};
