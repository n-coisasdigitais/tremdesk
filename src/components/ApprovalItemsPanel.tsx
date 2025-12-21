import { useState } from 'react';
import { useApprovalItems } from '@/hooks/useApprovalItems';
import { ApprovalItem, ApprovalItemIssue, ApprovalItemStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  FileImage,
  Loader2,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApprovalItemsPanelProps {
  ticketId: string;
  canAddItems?: boolean;
  canReview?: boolean;
}

const statusConfig: Record<ApprovalItemStatus, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pendente', icon: AlertCircle, color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovado', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  changes_requested: { label: 'Alterações solicitadas', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

export const ApprovalItemsPanel = ({
  ticketId,
  canAddItems = false,
  canReview = false,
}: ApprovalItemsPanelProps) => {
  const {
    items,
    loading,
    createItem,
    updateItemStatus,
    deleteItem,
    createIssue,
    resolveIssue,
  } = useApprovalItems(ticketId);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<ApprovalItem | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [feedback, setFeedback] = useState('');
  const [newIssueText, setNewIssueText] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleCreateItem = async () => {
    if (!newTitle.trim()) return;

    await createItem({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      file_url: newFileUrl.trim() || undefined,
    });

    setNewTitle('');
    setNewDescription('');
    setNewFileUrl('');
    setIsAddDialogOpen(false);
  };

  const openReviewDialog = (item: ApprovalItem) => {
    setReviewingItem(item);
    setFeedback(item.feedback || '');
    setNewIssueText('');
    setIsReviewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!reviewingItem) return;
    await updateItemStatus(reviewingItem.id, 'approved', feedback.trim() || undefined);
    setIsReviewDialogOpen(false);
  };

  const handleRequestChanges = async () => {
    if (!reviewingItem) return;
    await updateItemStatus(reviewingItem.id, 'changes_requested', feedback.trim() || undefined);
    setIsReviewDialogOpen(false);
  };

  const handleAddIssue = async () => {
    if (!reviewingItem || !newIssueText.trim()) return;
    await createIssue(reviewingItem.id, newIssueText.trim());
    setNewIssueText('');
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Itens de Aprovação</h3>
        {canAddItems && (
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Nenhum item de aprovação adicionado.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const status = statusConfig[item.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedItems.has(item.id);
            const openIssues = item.issues?.filter(i => i.status === 'open') || [];

            return (
              <Card key={item.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(item.id)}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {item.file_url ? (
                              <FileImage className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            )}
                            {item.title}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {openIssues.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {openIssues.length} pendência(s)
                          </Badge>
                        )}
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                        {canReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewDialog(item)}
                          >
                            Revisar
                          </Button>
                        )}
                        {canAddItems && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.description}
                        </p>
                      )}

                      {item.file_url && (
                        <div className="mb-3">
                          <img
                            src={item.file_url}
                            alt={item.title}
                            className="max-w-full h-auto rounded-lg border"
                          />
                        </div>
                      )}

                      {item.feedback && (
                        <div className="bg-muted p-3 rounded-lg mb-3">
                          <p className="text-sm font-medium mb-1">Feedback:</p>
                          <p className="text-sm">{item.feedback}</p>
                          {item.reviewer && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={item.reviewer.avatar_url || undefined} />
                                <AvatarFallback>
                                  {item.reviewer.full_name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{item.reviewer.full_name}</span>
                              {item.reviewed_at && (
                                <span>
                                  • {format(new Date(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Issues */}
                      {(item.issues?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Pendências:</p>
                          {item.issues?.map((issue) => (
                            <div
                              key={issue.id}
                              className={`flex items-start justify-between p-2 rounded border ${
                                issue.status === 'resolved'
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-yellow-50 border-yellow-200'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {issue.status === 'resolved' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                )}
                                <span className={`text-sm ${issue.status === 'resolved' ? 'line-through text-muted-foreground' : ''}`}>
                                  {issue.description}
                                </span>
                              </div>
                              {issue.status === 'open' && canAddItems && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => resolveIssue(issue.id)}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item de Aprovação</DialogTitle>
            <DialogDescription>
              Adicione um item para o cliente aprovar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <Input
                placeholder="Ex: Banner principal do site"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Descreva o item..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL da Imagem/Arquivo</label>
              <Input
                placeholder="https://..."
                value={newFileUrl}
                onChange={(e) => setNewFileUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateItem} disabled={!newTitle.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar: {reviewingItem?.title}</DialogTitle>
            <DialogDescription>
              Aprove o item ou solicite alterações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {reviewingItem?.file_url && (
              <div className="mb-3">
                <img
                  src={reviewingItem.file_url}
                  alt={reviewingItem.title}
                  className="max-w-full h-auto rounded-lg border"
                />
              </div>
            )}

            {reviewingItem?.description && (
              <p className="text-sm text-muted-foreground">
                {reviewingItem.description}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Feedback (opcional)</label>
              <Textarea
                placeholder="Adicione comentários sobre este item..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            {/* Add issue section */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium">Adicionar Pendência</label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Descreva a pendência..."
                  value={newIssueText}
                  onChange={(e) => setNewIssueText(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleAddIssue}
                  disabled={!newIssueText.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Existing issues */}
            {reviewingItem?.issues && reviewingItem.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Pendências:</p>
                {reviewingItem.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      issue.status === 'resolved'
                        ? 'bg-green-50 text-green-800'
                        : 'bg-yellow-50 text-yellow-800'
                    }`}
                  >
                    {issue.status === 'resolved' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className={`text-sm ${issue.status === 'resolved' ? 'line-through' : ''}`}>
                      {issue.description}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestChanges}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Solicitar Alterações
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
