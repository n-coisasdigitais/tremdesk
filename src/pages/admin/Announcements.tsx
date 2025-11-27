import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Plus, Pencil, Trash2, Bell, Mail, AlertTriangle, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Company {
  id: string;
  name: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  target_type: string;
  target_company_id: string | null;
  notify_bell: boolean;
  notify_page: boolean;
  notify_email: boolean;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

const Announcements = () => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    target_type: 'all',
    target_company_id: '',
    notify_bell: true,
    notify_page: true,
    notify_email: false,
    expires_at: '',
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchCompanies();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar avisos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    
    if (data) setCompanies(data);
  };

  const handleOpenDialog = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        target_type: announcement.target_type,
        target_company_id: announcement.target_company_id || '',
        notify_bell: announcement.notify_bell,
        notify_page: announcement.notify_page,
        notify_email: announcement.notify_email,
        expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        content: '',
        priority: 'normal',
        target_type: 'all',
        target_company_id: '',
        notify_bell: true,
        notify_page: true,
        notify_email: false,
        expires_at: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'Erro',
        description: 'Título e conteúdo são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const announcementData = {
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        target_type: formData.target_type,
        target_company_id: formData.target_type === 'specific_company' ? formData.target_company_id : null,
        notify_bell: formData.notify_bell,
        notify_page: formData.notify_page,
        notify_email: formData.notify_email,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        created_by: user?.id,
      };

      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id);

        if (error) throw error;

        toast({
          title: 'Aviso atualizado',
          description: 'O aviso foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(announcementData);

        if (error) throw error;

        toast({
          title: 'Aviso criado',
          description: 'O aviso foi publicado com sucesso.',
        });

        // TODO: Se notify_email estiver ativo, disparar emails via edge function
      }

      setIsDialogOpen(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar aviso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ active: !announcement.active })
        .eq('id', announcement.id);

      if (error) throw error;

      toast({
        title: announcement.active ? 'Aviso desativado' : 'Aviso ativado',
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aviso?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Aviso excluído',
        description: 'O aviso foi removido com sucesso.',
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir aviso',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Urgente</Badge>;
      case 'important':
        return <Badge className="bg-amber-500"><AlertCircle className="h-3 w-3 mr-1" />Importante</Badge>;
      default:
        return <Badge variant="secondary"><Info className="h-3 w-3 mr-1" />Normal</Badge>;
    }
  };

  const getTargetLabel = (targetType: string, companyId: string | null) => {
    switch (targetType) {
      case 'all':
        return 'Todos';
      case 'clients':
        return 'Clientes';
      case 'team':
        return 'Equipe';
      case 'specific_company':
        const company = companies.find(c => c.id === companyId);
        return company ? company.name : 'Empresa específica';
      default:
        return targetType;
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="h-8 w-8" />
              Avisos e Comunicações
            </h1>
            <p className="text-muted-foreground">
              Gerencie os avisos exibidos para usuários do sistema.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Aviso
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Avisos</CardTitle>
            <CardDescription>
              {announcements.length} aviso(s) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando avisos...
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum aviso cadastrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Público</TableHead>
                    <TableHead>Notificações</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id} className={!announcement.active ? 'opacity-50' : ''}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(announcement)}
                        >
                          {announcement.active ? (
                            <Eye className="h-4 w-4 text-green-500" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{announcement.title}</span>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {announcement.content}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(announcement.priority)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {getTargetLabel(announcement.target_type, announcement.target_company_id)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {announcement.notify_bell && (
                            <span title="Sino"><Bell className="h-4 w-4 text-muted-foreground" /></span>
                          )}
                          {announcement.notify_page && (
                            <span title="Página"><AlertCircle className="h-4 w-4 text-muted-foreground" /></span>
                          )}
                          {announcement.notify_email && (
                            <span title="Email"><Mail className="h-4 w-4 text-muted-foreground" /></span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(announcement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(announcement)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(announcement.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog for Create/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? 'Editar Aviso' : 'Novo Aviso'}
              </DialogTitle>
              <DialogDescription>
                {editingAnnouncement
                  ? 'Atualize as informações do aviso.'
                  : 'Crie um novo aviso para os usuários.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título do aviso"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Conteúdo do aviso"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Importante</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Público-alvo</Label>
                  <Select
                    value={formData.target_type}
                    onValueChange={(v) => setFormData({ ...formData, target_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="clients">Apenas Clientes</SelectItem>
                      <SelectItem value="team">Apenas Equipe</SelectItem>
                      <SelectItem value="specific_company">Empresa Específica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.target_type === 'specific_company' && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select
                    value={formData.target_company_id}
                    onValueChange={(v) => setFormData({ ...formData, target_company_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="expires_at">Data de Expiração (opcional)</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label>Tipos de Notificação</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span className="text-sm">Notificação no sino</span>
                    </div>
                    <Switch
                      checked={formData.notify_bell}
                      onCheckedChange={(v) => setFormData({ ...formData, notify_bell: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">Alerta na página</span>
                    </div>
                    <Switch
                      checked={formData.notify_page}
                      onCheckedChange={(v) => setFormData({ ...formData, notify_page: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">Disparo de email</span>
                    </div>
                    <Switch
                      checked={formData.notify_email}
                      onCheckedChange={(v) => setFormData({ ...formData, notify_email: v })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingAnnouncement ? 'Salvar' : 'Publicar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Announcements;
