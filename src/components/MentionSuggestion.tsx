import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MentionSuggestionProps {
  query: string;
  command: (props: { id: string; label: string }) => void;
}

export interface MentionSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ query, command }, ref) => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const fetchUsers = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .ilike('full_name', `%${query}%`)
            .limit(5);

          if (!error && data) {
            setUsers(data);
          }
        } catch (error) {
          console.error('Error fetching users for mention:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchUsers();
    }, [query]);

    const selectItem = (index: number) => {
      const user = users[index];
      if (user) {
        command({ id: user.id, label: user.full_name });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % users.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (loading) {
      return (
        <div className="bg-popover border rounded-md shadow-md p-2">
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="bg-popover border rounded-md shadow-md p-2">
          <span className="text-sm text-muted-foreground">Nenhum usuário encontrado</span>
        </div>
      );
    }

    return (
      <div className="bg-popover border rounded-md shadow-md overflow-hidden">
        {users.map((user, index) => (
          <button
            key={user.id}
            onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-2 p-2 text-left hover:bg-accent ${
              index === selectedIndex ? 'bg-accent' : ''
            }`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{user.full_name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{user.full_name}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionSuggestion.displayName = 'MentionSuggestion';
