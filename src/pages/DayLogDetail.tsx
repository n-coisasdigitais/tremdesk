import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar,
  CheckSquare,
  Clock,
  Target,
  Link as LinkIcon,
  Bot,
  FileText,
  ExternalLink,
  Paperclip,
  Upload,
  X,
  Save,
  Plus,
  Mail
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  useDayLogs, 
  DayLog, 
  DayLogAttachment,
  DayLogFormData 
} from '@/hooks/useDayLogs';
import { useDayLogTags } from '@/hooks/useDayLogTags';
import { useAuth } from '@/hooks/useAuth';
import { CreateTicketFromDayLog } from '@/components/CreateTicketFromDayLog';
import { DayLogComments } from '@/components/DayLogComments';
import { SendDayLogEmailDialog } from '@/components/SendDayLogEmailDialog';
import { DayLogTipTapEditor } from '@/components/DayLogTipTapEditor';
import { DayLogEmailHistory } from '@/components/DayLogEmailHistory';
import { cn } from '@/lib/utils';

export default function DayLogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getDayLogById, 
    updateDayLog, 
    deleteDayLog,
    getAttachments,
    uploadAttachment,
    deleteAttachment 
  } = useDayLogs();
  const { tags: dynamicTags, getTagColors } = useDayLogTags();
  const { user, isAdmin } = useAuth();
  
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [attachments, setAttachments] = useState<DayLogAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editData, setEditData] = useState<DayLogFormData>({
    date: '',
    description: '',
    work_done: '',
    work_pending: '',
    next_steps: '',
    work_done_json: null,
    work_pending_json: null,
    next_steps_json: null,
    tags: [],
    transcription_url: '',
    ai_assistant_url: '',
    meeting_notes: '',
  });
  const [editDate, setEditDate] = useState<Date>(new Date());

  useEffect(() => {
    if (id) {
      loadDayLog();
    }
  }, [id]);

  const loadDayLog = async () => {
    if (!id) return;
    
    setLoading(true);
    const data = await getDayLogById(id);
    if (data) {
      setDayLog(data);
      setEditData({
        date: data.date,
        description: data.description || '',
        work_done: data.work_done,
        work_pending: data.work_pending || '',
        next_steps: data.next_steps || '',
        work_done_json: data.work_done_json || null,
        work_pending_json: data.work_pending_json || null,
        next_steps_json: data.next_steps_json || null,
        tags: data.tags || [],
        transcription_url: data.transcription_url || '',
        ai_assistant_url: data.ai_assistant_url || '',
        meeting_notes: data.meeting_notes || '',
      });
      setEditDate(new Date(data.date));
      
      // Load attachments
      const attachmentsData = await getAttachments(id);
      setAttachments(attachmentsData);
    }
    setLoading(false);
  };

  const handleEditDateSelect = (date: Date | undefined) => {
    if (date) {
      setEditDate(date);
      setEditData(prev => ({
        ...prev,
        date: format(date, 'yyyy-MM-dd'),
      }));
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSave = async () => {
    if (!id || !editData.work_done.trim()) return;
    
    setSaving(true);
    const result = await updateDayLog(id, editData);
    if (result) {
      await loadDayLog();
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleting(true);
    const success = await deleteDayLog(id);
    if (success) {
      navigate('/daylog');
    }
    setDeleting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadAttachment(id, file);
    }
    
    // Reload attachments
    const attachmentsData = await getAttachments(id);
    setAttachments(attachmentsData);
    setUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const success = await deleteAttachment(attachmentId);
    if (success && id) {
      const attachmentsData = await getAttachments(id);
      setAttachments(attachmentsData);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canEdit = dayLog && (user?.id === dayLog.user_id || isAdmin);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              <Skeleton className="h-20 w-full mb-4" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!dayLog) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">DayLog não encontrado</h2>
          <p className="text-muted-foreground mb-4">O registro solicitado não existe ou foi removido.</p>
          <Button onClick={() => navigate('/daylog')}>Voltar para listagem</Button>
        </div>
      </Layout>
    );
  }

  const profile = dayLog.profiles;

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/daylog')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                DayLog de {profile?.full_name || 'Usuário'}
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(dayLog.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !editData.work_done.trim()}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <SendDayLogEmailDialog 
                    dayLogId={dayLog.id}
                    dayLogDate={format(new Date(dayLog.date), "dd/MM/yyyy")}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir DayLog?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O registro será permanentemente removido.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={deleting}
                        >
                          {deleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
        </div>

        {/* Author Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile?.full_name ? getInitials(profile.full_name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{profile?.full_name || 'Usuário'}</p>
                <p className="text-sm text-muted-foreground">
                  Criado em {format(new Date(dayLog.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isEditing ? (
          // Edit Mode
          <>
            {/* Date Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data</CardTitle>
              </CardHeader>
              <CardContent>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(editDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editDate}
                      onSelect={handleEditDateSelect}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            {/* Description Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo do dia</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Ex: Dia focado em campanhas do cliente X"
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                />
              </CardContent>
            </Card>

            {/* Activities Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-green-600" />
                  O que foi feito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[150px]"
                  value={editData.work_done}
                  onChange={(e) => setEditData(prev => ({ ...prev, work_done: e.target.value }))}
                  required
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  O que ficou pendente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[100px]"
                  value={editData.work_pending}
                  onChange={(e) => setEditData(prev => ({ ...prev, work_pending: e.target.value }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Próximos passos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[100px]"
                  value={editData.next_steps}
                  onChange={(e) => setEditData(prev => ({ ...prev, next_steps: e.target.value }))}
                />
              </CardContent>
            </Card>

            {/* Tags Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {dynamicTags.map((tag) => {
                    const isSelected = editData.tags.includes(tag.name);
                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className={cn(
                          'cursor-pointer transition-all px-3 py-1',
                          isSelected ? 'border-transparent' : 'hover:bg-muted'
                        )}
                        style={isSelected ? { backgroundColor: tag.bg_color, color: tag.text_color } : {}}
                        onClick={() => toggleEditTag(tag.name)}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Links Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Links Externos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Link da transcrição
                  </Label>
                  <Input
                    type="url"
                    placeholder="https://fireflies.ai/..."
                    value={editData.transcription_url}
                    onChange={(e) => setEditData(prev => ({ ...prev, transcription_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Link da IA/Assistente
                  </Label>
                  <Input
                    type="url"
                    placeholder="https://chat.openai.com/..."
                    value={editData.ai_assistant_url}
                    onChange={(e) => setEditData(prev => ({ ...prev, ai_assistant_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas de reunião</Label>
                  <Textarea
                    className="min-h-[80px]"
                    value={editData.meeting_notes}
                    onChange={(e) => setEditData(prev => ({ ...prev, meeting_notes: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          // View Mode
          <>
            {/* Description */}
            {dayLog.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">{dayLog.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <div className="space-y-4">
              {/* Work Done */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                    O que foi feito
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap">{dayLog.work_done}</p>
                </CardContent>
              </Card>

            {/* Work Pending */}
              {dayLog.work_pending && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      O que ficou pendente
                    </CardTitle>
                    {canEdit && (
                      <CreateTicketFromDayLog
                        daylogId={dayLog.id}
                        defaultTitle={`Pendência: ${dayLog.description || 'DayLog ' + format(new Date(dayLog.date), 'dd/MM')}`}
                        defaultDescription={dayLog.work_pending}
                        defaultCompanyId={dayLog.company_id || ''}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Criar Demanda
                          </Button>
                        }
                      />
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground whitespace-pre-wrap">{dayLog.work_pending}</p>
                  </CardContent>
                </Card>
              )}

              {/* Next Steps */}
              {dayLog.next_steps && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Próximos passos
                    </CardTitle>
                    {canEdit && (
                      <CreateTicketFromDayLog
                        daylogId={dayLog.id}
                        defaultTitle={`Próximo passo: ${dayLog.description || 'DayLog ' + format(new Date(dayLog.date), 'dd/MM')}`}
                        defaultDescription={dayLog.next_steps}
                        defaultCompanyId={dayLog.company_id || ''}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Criar Demanda
                          </Button>
                        }
                      />
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground whitespace-pre-wrap">{dayLog.next_steps}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Tags */}
            {dayLog.tags && dayLog.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {dayLog.tags.map((tag) => {
                      const colors = getTagColors(tag);
                      return (
                        <Badge
                          key={tag}
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* External Links */}
            {(dayLog.transcription_url || dayLog.ai_assistant_url || dayLog.meeting_notes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Links Externos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dayLog.transcription_url && (
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4" />
                        Transcrição
                      </Label>
                      <a 
                        href={dayLog.transcription_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Abrir transcrição
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {dayLog.ai_assistant_url && (
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4" />
                        IA/Assistente
                      </Label>
                      <a 
                        href={dayLog.ai_assistant_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Abrir conversa
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {dayLog.meeting_notes && (
                    <div>
                      <Label className="text-muted-foreground mb-1 block">Notas de reunião</Label>
                      <p className="text-foreground whitespace-pre-wrap">{dayLog.meeting_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Anexos
                </CardTitle>
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Enviando...' : 'Anexar'}
                    </Button>
                  </>
                )}
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum anexo adicionado.</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div 
                        key={attachment.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <a
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm hover:underline text-foreground"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {attachment.file_name}
                        </a>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email History Section */}
            <DayLogEmailHistory dayLogId={dayLog.id} />

            {/* Comments Section */}
            <DayLogComments 
              dayLogId={dayLog.id}
              dayLogDescription={dayLog.description || undefined}
              companyId={dayLog.company_id || undefined}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
