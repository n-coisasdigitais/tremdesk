import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TipTapEditor } from './TipTapEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Ticket, TicketComment, Approval, Profile } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Clock, MessageSquare, Activity, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusConfig = {
  novo: { label: 'Novo', color: 'bg-blue-500' },
  em_andamento: { label: 'Em Andamento', color: 'bg-yellow-500' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'bg-orange-500' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500' },
  concluido: { label: 'Concluído', color: 'bg-gray-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500' },
};

const priorityConfig = {
  baixa: { label: 'Baixa', color: 'bg-blue-100 text-blue-800' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800' },
};

interface ActivityItem {
  id: string;
  type: 'comment' | 'activity' | 'approval';
  created_at: string;
  user?: Profile;
  content?: any;
  action_type?: string;
  metadata_json?: any;
  status?: string;
  feedback_json?: any;
}

export const TicketDetailModal = ({ ticket, open, onOpenChange, onUpdate }: TicketDetailModalProps) => {
  const { user, isAdmin, isTeamMember, isClientAdmin, isClientUser } = useAuth();
  const isClient = isClientAdmin || isClientUser;
  const { toast } = useToast();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [newComment, setNewComment] = useState<any>(null);
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (ticket && open) {
      fetchData();
    }
  }, [ticket, open]);

  const fetchData = async () => {
    if (!ticket) return;

    // Fetch comments
    const { data: commentsData } = await supabase
      .from('ticket_comments')
      .select('*, user:profiles(*)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    // Fetch activities
    const { data: activitiesData } = await supabase
      .from('ticket_activities')
      .select('*, user:profiles(*)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    // Fetch approvals
    const { data: approvalsData } = await supabase
      .from('approvals')
      .select('*, approved_by:profiles(*)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    // Build timeline
    const timelineItems: ActivityItem[] = [
      ...(commentsData || []).map((c: any) => ({
        ...c,
        type: 'comment' as const,
      })),
      ...(activitiesData || []).map((a: any) => ({
        ...a,
        type: 'activity' as const,
      })),
      ...(approvalsData || []).map((a: any) => ({
        ...a,
        type: 'approval' as const,
        user: a.approved_by,
      })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setComments(commentsData || []);
    setActivities(activitiesData || []);
    setApprovals((approvalsData || []) as any);
    setTimeline(timelineItems);
  };

  const handleAddComment = async () => {
    if (!ticket || !newComment || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('ticket_comments').insert([{
        ticket_id: ticket.id,
        user_id: user.id,
        content_json: newComment,
      }]);

      if (error) throw error;

      // Check for mentions in the content and create notifications
      const mentions = extractMentions(newComment);
      for (const mentionedUserId of mentions) {
        await supabase.from('mentions').insert([{
          ticket_id: ticket.id,
          mentioned_user_id: mentionedUserId,
          mentioned_by: user.id,
        }]);
        await supabase.from('notifications').insert([{
          user_id: mentionedUserId,
          type: 'mention',
          ticket_id: ticket.id,
        }]);
      }

      setNewComment(null);
      await fetchData();
      toast({ title: 'Comentário adicionado!' });
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar comentário', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const extractMentions = (content: any): string[] => {
    const mentions: string[] = [];
    const traverse = (node: any) => {
      if (node.type === 'mention' && node.attrs?.id) {
        mentions.push(node.attrs.id);
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    if (content?.content) {
      content.content.forEach(traverse);
    }
    return mentions;
  };

  const handleApprove = async () => {
    if (!ticket || !user) return;

    setLoading(true);
    try {
      // Create approval record
      await supabase.from('approvals').insert([{
        ticket_id: ticket.id,
        approved_by: user.id,
        status: 'approved',
      }]);

      // Update ticket status
      await supabase.from('tickets').update({ status: 'aprovado' }).eq('id', ticket.id);

      // Log activity
      await supabase.from('ticket_activities').insert([{
        ticket_id: ticket.id,
        user_id: user.id,
        action_type: 'approved',
      }]);

      // Notify team
      if (ticket.assigned_to) {
        await supabase.from('notifications').insert([{
          user_id: ticket.assigned_to,
          type: 'approval',
          ticket_id: ticket.id,
        }]);
      }

      toast({ title: 'Demanda aprovada!' });
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!ticket || !user || !approvalFeedback) return;

    setLoading(true);
    try {
      // Create approval record with changes requested
      await supabase.from('approvals').insert([{
        ticket_id: ticket.id,
        approved_by: user.id,
        status: 'changes_requested',
        feedback_json: { text: approvalFeedback },
      }]);

      // Update ticket status back to in progress
      await supabase.from('tickets').update({ status: 'em_andamento' }).eq('id', ticket.id);

      // Log activity
      await supabase.from('ticket_activities').insert([{
        ticket_id: ticket.id,
        user_id: user.id,
        action_type: 'changes_requested',
        metadata_json: { feedback: approvalFeedback },
      }]);

      // Notify team
      if (ticket.assigned_to) {
        await supabase.from('notifications').insert([{
          user_id: ticket.assigned_to,
          type: 'changes_requested',
          ticket_id: ticket.id,
        }]);
      }

      toast({ title: 'Alterações solicitadas!' });
      setApprovalFeedback('');
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Erro ao solicitar alterações', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !user) return;

    setLoading(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'concluido') {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase.from('tickets').update(updateData).eq('id', ticket.id);

      await supabase.from('ticket_activities').insert([{
        ticket_id: ticket.id,
        user_id: user.id,
        action_type: 'status_changed',
        metadata_json: { from: ticket.status, to: newStatus },
      }]);

      toast({ title: 'Status atualizado!' });
      await fetchData();
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!ticket) return null;

  const canChangeStatus = isAdmin || isTeamMember;
  const canApprove = isClient && ticket.status === 'aguardando_aprovacao';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex-1">{ticket.title}</span>
            <Badge className={priorityConfig[ticket.priority].color}>
              {priorityConfig[ticket.priority].label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Status & Info */}
          <div className="flex flex-wrap gap-4 items-center">
            {canChangeStatus ? (
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${statusConfig[ticket.status].color}`} />
                {statusConfig[ticket.status].label}
              </Badge>
            )}

            {ticket.company && (
              <Badge variant="secondary">{ticket.company.name}</Badge>
            )}

            {ticket.due_date && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(ticket.due_date), 'dd/MM/yyyy', { locale: ptBR })}
              </Badge>
            )}

            {ticket.assignee && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                  <AvatarFallback>{ticket.assignee.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{ticket.assignee.full_name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {ticket.description_json && (
            <div className="border rounded-md p-4 bg-muted/30">
              <TipTapEditor content={ticket.description_json} editable={false} />
            </div>
          )}

          {/* Approval Section */}
          {canApprove && (
            <div className="border rounded-md p-4 bg-yellow-50 dark:bg-yellow-900/20 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aguardando sua aprovação
              </h4>
              <div className="flex gap-2">
                <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
                <Button variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                  <X className="h-4 w-4 mr-2" />
                  Solicitar Alteração
                </Button>
              </div>
              <Textarea
                placeholder="Descreva as alterações necessárias..."
                value={approvalFeedback}
                onChange={(e) => setApprovalFeedback(e.target.value)}
              />
              {approvalFeedback && (
                <Button onClick={handleRequestChanges} disabled={loading} variant="outline">
                  Enviar Feedback
                </Button>
              )}
            </div>
          )}

          <Separator />

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Histórico
            </h4>

            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.user?.avatar_url || undefined} />
                    <AvatarFallback>{item.user?.full_name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{item.user?.full_name || 'Sistema'}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(item.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {item.type === 'comment' && (
                      <div className="border rounded-md p-3 bg-card">
                        <TipTapEditor content={(item as any).content_json} editable={false} />
                      </div>
                    )}

                    {item.type === 'activity' && (
                      <p className="text-sm text-muted-foreground">
                        {item.action_type === 'status_changed' && (
                          <>Mudou status de <Badge variant="outline">{item.metadata_json?.from}</Badge> para <Badge variant="outline">{item.metadata_json?.to}</Badge></>
                        )}
                        {item.action_type === 'approved' && 'Aprovou a demanda'}
                        {item.action_type === 'changes_requested' && `Solicitou alterações: ${item.metadata_json?.feedback}`}
                        {item.action_type === 'assigned' && 'Atribuiu a demanda'}
                      </p>
                    )}

                    {item.type === 'approval' && (
                      <div className={`text-sm p-2 rounded ${
                        item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {item.status === 'approved' ? '✓ Aprovado' : `⚠ Alterações solicitadas: ${item.feedback_json?.text || ''}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atividade ainda
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* New Comment */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Novo Comentário
            </h4>
            <TipTapEditor
              content={newComment}
              onChange={setNewComment}
              placeholder="Escreva um comentário... Use @nome para mencionar"
            />
            <div className="flex justify-end">
              <Button onClick={handleAddComment} disabled={loading || !newComment}>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
