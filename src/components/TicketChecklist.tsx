import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TicketChecklistItem } from '@/types';
import { Plus, Trash2, GripVertical, CheckSquare } from 'lucide-react';

interface TicketChecklistProps {
  ticketId: string;
}

export const TicketChecklist = ({ ticketId }: TicketChecklistProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<TicketChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [ticketId]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('ticket_checklist_items')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching checklist:', error);
      return;
    }

    setItems(data || []);
  };

  const handleAddItem = async () => {
    if (!newItem.trim() || !user) return;

    setLoading(true);
    try {
      const maxPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) : -1;
      
      const { error } = await supabase.from('ticket_checklist_items').insert([{
        ticket_id: ticketId,
        content: newItem.trim(),
        position: maxPosition + 1,
      }]);

      if (error) throw error;

      setNewItem('');
      await fetchItems();
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (item: TicketChecklistItem) => {
    if (!user) return;

    try {
      const updates: any = {
        is_completed: !item.is_completed,
      };

      if (!item.is_completed) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user.id;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }

      const { error } = await supabase
        .from('ticket_checklist_items')
        .update(updates)
        .eq('id', item.id);

      if (error) throw error;

      await fetchItems();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar item', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('ticket_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchItems();
    } catch (error: any) {
      toast({ title: 'Erro ao remover item', description: error.message, variant: 'destructive' });
    }
  };

  const completedCount = items.filter(i => i.is_completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Checklist
        </h4>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} concluídos
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <Progress value={progressPercent} className="h-2" />
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={() => handleToggleItem(item)}
            />
            <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
              {item.content}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => handleDeleteItem(item.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Adicionar item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          className="flex-1"
        />
        <Button onClick={handleAddItem} disabled={loading || !newItem.trim()} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
