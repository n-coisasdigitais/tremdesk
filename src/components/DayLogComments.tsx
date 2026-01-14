import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageSquare, 
  Reply, 
  Trash2, 
  Edit2, 
  Plus,
  CornerDownRight,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useDayLogComments, DayLogComment } from '@/hooks/useDayLogComments';
import { useAuth } from '@/hooks/useAuth';
import { CreateTicketFromDayLog } from '@/components/CreateTicketFromDayLog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface DayLogCommentsProps {
  dayLogId: string;
  dayLogDescription?: string;
  companyId?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function extractTextFromJson(json: any): string {
  if (typeof json === 'string') return json;
  if (!json || typeof json !== 'object') return '';
  
  // TipTap JSON format
  if (json.type === 'doc' && Array.isArray(json.content)) {
    return json.content
      .map((node: any) => {
        if (node.type === 'paragraph' && Array.isArray(node.content)) {
          return node.content
            .map((item: any) => item.text || '')
            .join('');
        }
        return '';
      })
      .join('\n');
  }
  
  // Plain text fallback
  if (json.text) return json.text;
  
  return JSON.stringify(json);
}

interface CommentItemProps {
  comment: DayLogComment;
  onReply: (comment: DayLogComment) => void;
  onDelete: (commentId: string) => void;
  onEdit: (comment: DayLogComment) => void;
  dayLogId: string;
  dayLogDescription?: string;
  companyId?: string;
  isReply?: boolean;
}

function CommentItem({ 
  comment, 
  onReply, 
  onDelete, 
  onEdit, 
  dayLogId,
  dayLogDescription,
  companyId,
  isReply = false 
}: CommentItemProps) {
  const { user, isAdmin } = useAuth();
  const isAuthor = user?.id === comment.user_id;
  const canModify = isAuthor || isAdmin;
  const commentText = extractTextFromJson(comment.content_json);

  return (
    <div className={cn("group", isReply && "ml-8 border-l-2 border-muted pl-4")}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.profiles?.avatar_url || ''} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {comment.profiles?.full_name ? getInitials(comment.profiles.full_name) : '?'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {comment.profiles?.full_name || 'Usuário'}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
            {commentText}
          </p>
          
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onReply(comment)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Responder
            </Button>
            
            <CreateTicketFromDayLog
              daylogId={dayLogId}
              defaultTitle={`Comentário: ${dayLogDescription || 'DayLog'}`}
              defaultDescription={commentText}
              defaultCompanyId={companyId || ''}
              trigger={
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Criar Demanda
                </Button>
              }
            />
            
            {canModify && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(comment)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O comentário será permanentemente removido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onDelete(comment.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              dayLogId={dayLogId}
              dayLogDescription={dayLogDescription}
              companyId={companyId}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DayLogComments({ dayLogId, dayLogDescription, companyId }: DayLogCommentsProps) {
  const { comments, loading, fetchComments, addComment, updateComment, deleteComment } = useDayLogComments();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<DayLogComment | null>(null);
  const [editingComment, setEditingComment] = useState<DayLogComment | null>(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments(dayLogId);
  }, [dayLogId, fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    const contentJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: newComment.trim() }]
        }
      ]
    };
    
    const result = await addComment(dayLogId, contentJson, replyingTo?.id);
    if (result) {
      setNewComment('');
      setReplyingTo(null);
      await fetchComments(dayLogId);
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editingComment || !editContent.trim()) return;
    
    setSubmitting(true);
    const contentJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: editContent.trim() }]
        }
      ]
    };
    
    const success = await updateComment(editingComment.id, contentJson);
    if (success) {
      setEditingComment(null);
      setEditContent('');
      await fetchComments(dayLogId);
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const success = await deleteComment(commentId);
    if (success) {
      await fetchComments(dayLogId);
    }
  };

  const startEdit = (comment: DayLogComment) => {
    setEditingComment(comment);
    setEditContent(extractTextFromJson(comment.content_json));
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussão
          {totalComments > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({totalComments} {totalComments === 1 ? 'comentário' : 'comentários'})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment / Reply */}
        <div className="space-y-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
              <CornerDownRight className="h-4 w-4" />
              <span>Respondendo a {replyingTo.profiles?.full_name || 'Usuário'}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={cancelReply}>
                Cancelar
              </Button>
            </div>
          )}
          
          {editingComment ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Editando comentário:</div>
              <Textarea
                placeholder="Editar comentário..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleEdit} 
                  disabled={submitting || !editContent.trim()}
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Textarea
                placeholder={replyingTo ? "Escreva sua resposta..." : "Adicione um comentário..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] flex-1"
              />
              <Button 
                size="icon" 
                onClick={handleSubmit} 
                disabled={submitting || !newComment.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Comments List */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Carregando comentários...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={setReplyingTo}
                onDelete={handleDelete}
                onEdit={startEdit}
                dayLogId={dayLogId}
                dayLogDescription={dayLogDescription}
                companyId={companyId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
