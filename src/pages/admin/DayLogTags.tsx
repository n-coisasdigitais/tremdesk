import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useDayLogTags, DayLogTag, DayLogTagFormData } from '@/hooks/useDayLogTags';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

export default function DayLogTags() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { tags, loading, fetchTags, createTag, updateTag, deleteTag, toggleTagActive } = useDayLogTags();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<DayLogTag | null>(null);
  const [deletingTag, setDeletingTag] = useState<DayLogTag | null>(null);
  const [formData, setFormData] = useState<DayLogTagFormData>({
    name: '',
    bg_color: '#f3f4f6',
    text_color: '#374151',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  // Fetch all tags including inactive for admin view
  useState(() => {
    fetchTags(true);
  });

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const openCreateDialog = () => {
    setEditingTag(null);
    setFormData({
      name: '',
      bg_color: '#f3f4f6',
      text_color: '#374151',
      active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (tag: DayLogTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      bg_color: tag.bg_color,
      text_color: tag.text_color,
      active: tag.active,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (tag: DayLogTag) => {
    setDeletingTag(tag);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      if (editingTag) {
        await updateTag(editingTag.id, formData);
      } else {
        await createTag(formData);
      }
      setIsDialogOpen(false);
      fetchTags(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;
    
    await deleteTag(deletingTag.id);
    setIsDeleteDialogOpen(false);
    setDeletingTag(null);
  };

  const handleToggleActive = async (tag: DayLogTag) => {
    await toggleTagActive(tag.id, !tag.active);
    fetchTags(true);
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6" />
              Tags de DayLog
            </h1>
            <p className="text-muted-foreground">
              Gerencie as tags disponíveis para os registros diários
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Tag
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              Lista de todas as tags disponíveis para categorizar DayLogs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma tag cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Cor de Fundo</TableHead>
                    <TableHead>Cor do Texto</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} className={!tag.active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: tag.bg_color,
                            color: tag.text_color,
                          }}
                        >
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: tag.bg_color }}
                          />
                          <span className="text-sm text-muted-foreground">{tag.bg_color}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: tag.text_color }}
                          />
                          <span className="text-sm text-muted-foreground">{tag.text_color}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={tag.active}
                          onCheckedChange={() => handleToggleActive(tag)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(tag)}
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Editar Tag' : 'Nova Tag'}
            </DialogTitle>
            <DialogDescription>
              {editingTag 
                ? 'Altere as informações da tag abaixo'
                : 'Preencha as informações para criar uma nova tag'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Reunião"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bg_color">Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    id="bg_color"
                    type="color"
                    value={formData.bg_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, bg_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.bg_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, bg_color: e.target.value }))}
                    placeholder="#f3f4f6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text_color">Cor do Texto</Label>
                <div className="flex gap-2">
                  <Input
                    id="text_color"
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.text_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                    placeholder="#374151"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 border rounded-lg bg-muted/50">
                <Badge
                  style={{
                    backgroundColor: formData.bg_color,
                    color: formData.text_color,
                  }}
                >
                  {formData.name || 'Preview'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
              />
              <Label htmlFor="active">Tag ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !formData.name.trim()}>
              {saving ? 'Salvando...' : editingTag ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tag "{deletingTag?.name}"? 
              Esta ação não pode ser desfeita. DayLogs que usam esta tag manterão 
              a referência, mas a tag não estará mais disponível para seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
