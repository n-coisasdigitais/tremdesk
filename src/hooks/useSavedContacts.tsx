import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SavedContact {
  id: string;
  created_by: string;
  name: string;
  email: string;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedContactFormData {
  name: string;
  email: string;
  company?: string;
  notes?: string;
}

export const useSavedContacts = () => {
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchContacts = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('saved_contacts')
        .select('*')
        .order('name', { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContacts(data as SavedContact[]);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, []);

  const createContact = async (formData: SavedContactFormData) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('saved_contacts')
        .insert({
          created_by: user.id,
          name: formData.name,
          email: formData.email.toLowerCase().trim(),
          company: formData.company || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Contato salvo com sucesso!');
      await fetchContacts();
      return data as SavedContact;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      if (error.code === '23505') {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error('Erro ao salvar contato');
      }
      return null;
    }
  };

  const updateContact = async (id: string, formData: Partial<SavedContactFormData>) => {
    try {
      const updateData: any = { ...formData };
      if (formData.email) {
        updateData.email = formData.email.toLowerCase().trim();
      }

      const { data, error } = await supabase
        .from('saved_contacts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Contato atualizado!');
      await fetchContacts();
      return data as SavedContact;
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Erro ao atualizar contato');
      return null;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Contato removido!');
      await fetchContacts();
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Erro ao remover contato');
      return false;
    }
  };

  const getContactByEmail = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('saved_contacts')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) throw error;
      return data as SavedContact | null;
    } catch (error) {
      console.error('Error fetching contact by email:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    loading,
    fetchContacts,
    createContact,
    updateContact,
    deleteContact,
    getContactByEmail,
  };
};
