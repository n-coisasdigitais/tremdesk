import { useState, useEffect } from 'react';
import { useWatchers } from '@/hooks/useWatchers';
import { TicketWatcher, Profile } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, Plus, X, Loader2 } from 'lucide-react';

interface TicketWatchersProps {
  ticketId: string;
  canEdit?: boolean;
}

export const TicketWatchers = ({ ticketId, canEdit = false }: TicketWatchersProps) => {
  const { getTicketWatchers, addWatcher, removeWatcher, loading } = useWatchers();
  const [watchers, setWatchers] = useState<TicketWatcher[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchWatchers = async () => {
    const data = await getTicketWatchers(ticketId);
    setWatchers(data);
    setIsLoading(false);
  };

  const fetchAvailableUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (data) {
      // Filter out users who are already watchers
      const watcherIds = watchers.map(w => w.user_id);
      setAvailableUsers(data.filter(u => !watcherIds.includes(u.id)));
    }
  };

  useEffect(() => {
    fetchWatchers();
  }, [ticketId]);

  useEffect(() => {
    if (isDialogOpen) {
      fetchAvailableUsers();
    }
  }, [isDialogOpen, watchers]);

  const handleAddWatcher = async () => {
    if (!selectedUserId) return;

    const success = await addWatcher(ticketId, selectedUserId);
    if (success) {
      setSelectedUserId('');
      setIsDialogOpen(false);
      fetchWatchers();
    }
  };

  const handleRemoveWatcher = async (userId: string) => {
    const success = await removeWatcher(ticketId, userId);
    if (success) {
      fetchWatchers();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Eye className="h-4 w-4" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Observadores ({watchers.length})</span>
        </div>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {watchers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {watchers.map((watcher) => (
            <div
              key={watcher.id}
              className="flex items-center gap-2 bg-muted rounded-full pl-1 pr-2 py-1"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={watcher.user?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {watcher.user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{watcher.user?.full_name}</span>
              {canEdit && (
                <button
                  onClick={() => handleRemoveWatcher(watcher.user_id)}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={loading}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum observador</p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Observador</DialogTitle>
            <DialogDescription>
              Selecione um usuário para acompanhar este ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {user.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddWatcher} disabled={!selectedUserId || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
