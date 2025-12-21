import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Navigate } from 'react-router-dom';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';

const EMOJI_OPTIONS = ['📋', '📱', '🔍', '💼', '🎨', '📊', '📈', '💡', '🎯', '🚀', '⚡', '🔧', '📝', '✉️', '🌐'];

const Categories = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📋');
  const [newColor, setNewColor] = useState('#6366f1');

  const handleCreate = async () => {
    if (!newName.trim()) return;

    await createCategory({
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
    });

    setNewName('');
    setNewIcon('📋');
    setNewColor('#6366f1');
    setIsCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!editingCategory || !newName.trim()) return;

    await updateCategory(editingCategory.id, {
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
    });

    setEditingCategory(null);
    setIsEditOpen(false);
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setNewName(category.name);
    setNewIcon(category.icon || '📋');
    setNewColor(category.color || '#6366f1');
    setIsEditOpen(true);
  };

  const handleToggleActive = async (category: any) => {
    await updateCategory(category.id, { active: !category.active });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      await deleteCategory(id);
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
              <Tags className="h-8 w-8" />
              Categorias
            </h1>
            <p className="text-muted-foreground">
              Gerencie as categorias dos tickets.
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Categoria</DialogTitle>
                <DialogDescription>
                  Crie uma nova categoria para os tickets.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Nome da categoria"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <Button
                        key={emoji}
                        variant={newIcon === emoji ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewIcon(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Label>Preview</Label>
                  <div className="mt-2">
                    <Badge style={{ backgroundColor: newColor, color: '#fff' }}>
                      {newIcon} {newName || 'Nome da categoria'}
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Categorias</CardTitle>
            <CardDescription>
              {categories.length} categoria(s) cadastrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando categorias...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Badge style={{ backgroundColor: category.color || '#6366f1', color: '#fff' }}>
                          {category.icon} {category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.active}
                          onCheckedChange={() => handleToggleActive(category)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Categoria</DialogTitle>
              <DialogDescription>
                Atualize os dados da categoria.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Nome da categoria"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant={newIcon === emoji ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewIcon(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-32"
                  />
                </div>
              </div>
              <div className="pt-2">
                <Label>Preview</Label>
                <div className="mt-2">
                  <Badge style={{ backgroundColor: newColor, color: '#fff' }}>
                    {newIcon} {newName || 'Nome da categoria'}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={!newName.trim()}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Categories;
