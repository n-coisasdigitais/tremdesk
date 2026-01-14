import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AdminExclusion {
  id: string;
  user_id: string;
  company_id: string;
  created_at: string;
  company_name?: string;
}

export const useAdminExclusions = () => {
  const [loading, setLoading] = useState(false);

  const getExclusionsForUser = async (userId: string): Promise<AdminExclusion[]> => {
    try {
      const { data, error } = await supabase
        .from('admin_company_exclusions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Fetch company names
      if (data && data.length > 0) {
        const companyIds = data.map(e => e.company_id);
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);

        const companyMap: Record<string, string> = {};
        companies?.forEach(c => {
          companyMap[c.id] = c.name;
        });

        return data.map(e => ({
          ...e,
          company_name: companyMap[e.company_id] || 'Empresa desconhecida',
        }));
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching exclusions:', error);
      return [];
    }
  };

  const addExclusion = async (userId: string, companyId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('admin_company_exclusions')
        .insert({
          user_id: userId,
          company_id: companyId,
          created_by: user?.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Exclusão já existe',
            description: 'Este administrador já está bloqueado desta empresa.',
            variant: 'destructive',
          });
          return false;
        }
        throw error;
      }

      toast({
        title: 'Exclusão adicionada',
        description: 'O administrador foi bloqueado de acessar esta empresa.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar exclusão',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeExclusion = async (userId: string, companyId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('admin_company_exclusions')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (error) throw error;

      toast({
        title: 'Exclusão removida',
        description: 'O administrador pode acessar esta empresa novamente.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao remover exclusão',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const syncExclusions = async (userId: string, selectedCompanyIds: string[]): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current exclusions
      const { data: currentExclusions } = await supabase
        .from('admin_company_exclusions')
        .select('company_id')
        .eq('user_id', userId);

      const currentCompanyIds = currentExclusions?.map(e => e.company_id) || [];

      // Determine what to add and remove
      const toAdd = selectedCompanyIds.filter(id => !currentCompanyIds.includes(id));
      const toRemove = currentCompanyIds.filter(id => !selectedCompanyIds.includes(id));

      // Remove exclusions
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('admin_company_exclusions')
          .delete()
          .eq('user_id', userId)
          .in('company_id', toRemove);

        if (removeError) throw removeError;
      }

      // Add new exclusions
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('admin_company_exclusions')
          .insert(
            toAdd.map(companyId => ({
              user_id: userId,
              company_id: companyId,
              created_by: user?.id,
            }))
          );

        if (addError) throw addError;
      }

      toast({
        title: 'Exclusões atualizadas',
        description: 'As configurações de acesso foram salvas.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar exclusões',
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
    getExclusionsForUser,
    addExclusion,
    removeExclusion,
    syncExclusions,
  };
};
