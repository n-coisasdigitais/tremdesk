import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Search, ExternalLink, Upload, FolderPlus, HardDrive, Loader2, CheckCircle, AlertCircle, Share2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  leads_system_url: string | null;
  assas_portal_url: string | null;
  google_drive_folder_id: string | null;
  created_at: string;
}

const Companies = () => {
  const { isAdmin, isTeamMember, user, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    leads_system_url: '',
    assas_portal_url: '',
    google_drive_folder_id: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
  const [sharingFolder, setSharingFolder] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareCompanyId, setShareCompanyId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar empresas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        leads_system_url: company.leads_system_url || '',
        assas_portal_url: company.assas_portal_url || '',
        google_drive_folder_id: company.google_drive_folder_id || '',
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        leads_system_url: '',
        assas_portal_url: '',
        google_drive_folder_id: '',
      });
    }
    setLogoFile(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da empresa é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let logoUrl = editingCompany?.logo_url || null;

      // Upload logo if selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('company_logos')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company_logos')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const companyData = {
        name: formData.name,
        leads_system_url: formData.leads_system_url || null,
        assas_portal_url: formData.assas_portal_url || null,
        google_drive_folder_id: formData.google_drive_folder_id || null,
        logo_url: logoUrl,
      };

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', editingCompany.id);

        if (error) throw error;

        toast({
          title: 'Empresa atualizada',
          description: 'As informações foram salvas com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert(companyData);

        if (error) throw error;

        toast({
          title: 'Empresa criada',
          description: 'A nova empresa foi cadastrada com sucesso.',
        });
      }

      setIsDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar empresa',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateDriveFolder = async (company: Company) => {
    setCreatingFolder(company.id);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-folders', {
        body: {
          action: 'create_company_folder',
          company_id: company.id,
          company_name: company.name,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Pasta criada com sucesso!',
        description: (
          <div className="flex flex-col gap-2">
            <span>A pasta foi criada no Google Drive.</span>
            {data?.folder_url && (
              <a 
                href={data.folder_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline flex items-center gap-1"
              >
                Abrir pasta <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });

      fetchCompanies();
    } catch (error: any) {
      console.error('Error creating drive folder:', error);
      toast({
        title: 'Erro ao criar pasta',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingFolder(null);
    }
  };

  const handleOpenShareDialog = (company: Company) => {
    setShareCompanyId(company.id);
    setShareEmail('');
    setShareDialogOpen(true);
  };

  const handleShareFolder = async () => {
    if (!shareCompanyId || !shareEmail) return;

    const company = companies.find(c => c.id === shareCompanyId);
    if (!company?.google_drive_folder_id) {
      toast({
        title: 'Erro',
        description: 'Esta empresa não tem uma pasta no Google Drive.',
        variant: 'destructive',
      });
      return;
    }

    setSharingFolder(shareCompanyId);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-folders', {
        body: {
          action: 'share_folder',
          folder_id: company.google_drive_folder_id,
          email: shareEmail,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Pasta compartilhada!',
        description: `A pasta foi compartilhada com ${shareEmail}.`,
      });

      setShareDialogOpen(false);
    } catch (error: any) {
      console.error('Error sharing folder:', error);
      toast({
        title: 'Erro ao compartilhar pasta',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSharingFolder(null);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isTeamMember) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Empresas
            </h1>
            <p className="text-muted-foreground">
              Gerencie as empresas clientes.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Empresas</CardTitle>
                <CardDescription>
                  {companies.length} empresa(s) cadastrada(s)
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando empresas...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Google Drive</TableHead>
                    <TableHead>Links Externos</TableHead>
                    <TableHead>Criada em</TableHead>
                    {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={company.logo_url || undefined} />
                            <AvatarFallback>
                              {company.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{company.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {company.google_drive_folder_id ? (
                            <>
                              <span className="flex items-center gap-1 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Configurado
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a 
                                  href={`https://drive.google.com/drive/folders/${company.google_drive_folder_id}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <HardDrive className="h-4 w-4" />
                                </a>
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenShareDialog(company)}
                                  title="Compartilhar pasta"
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateDriveFolder(company)}
                              disabled={creatingFolder === company.id}
                            >
                              {creatingFolder === company.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FolderPlus className="h-4 w-4 mr-2" />
                              )}
                              Criar Pasta
                            </Button>
                          ) : (
                            <span className="flex items-center gap-1 text-sm text-amber-600">
                              <AlertCircle className="h-4 w-4" />
                              Não configurado
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {company.leads_system_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={company.leads_system_url} target="_blank" rel="noopener noreferrer">
                                Leads <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                          {company.assas_portal_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={company.assas_portal_url} target="_blank" rel="noopener noreferrer">
                                Assas <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(company.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(company)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog for Create/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? 'Atualize as informações da empresa.'
                  : 'Preencha os dados para cadastrar uma nova empresa.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage 
                    src={logoFile ? URL.createObjectURL(logoFile) : editingCompany?.logo_url || undefined} 
                  />
                  <AvatarFallback className="text-xl">
                    {formData.name?.charAt(0).toUpperCase() || 'E'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="logo" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {editingCompany ? 'Alterar logo' : 'Adicionar logo'}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leads_url">URL do Sistema de Leads</Label>
                <Input
                  id="leads_url"
                  value={formData.leads_system_url}
                  onChange={(e) => setFormData({ ...formData, leads_system_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assas_url">URL do Portal Assas</Label>
                <Input
                  id="assas_url"
                  value={formData.assas_portal_url}
                  onChange={(e) => setFormData({ ...formData, assas_portal_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drive_folder">ID da Pasta Google Drive</Label>
                <Input
                  id="drive_folder"
                  value={formData.google_drive_folder_id}
                  onChange={(e) => setFormData({ ...formData, google_drive_folder_id: e.target.value })}
                  placeholder="ID da pasta no Google Drive"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Use o botão "Criar Pasta" na listagem para criar automaticamente.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingCompany ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Folder Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Compartilhar Pasta do Drive</DialogTitle>
              <DialogDescription>
                Compartilhe a pasta do Google Drive com um usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="share_email">Email do usuário</Label>
                <Input
                  id="share_email"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="usuario@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  O usuário receberá acesso de editor à pasta da empresa.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleShareFolder} 
                disabled={!shareEmail || sharingFolder === shareCompanyId}
              >
                {sharingFolder === shareCompanyId ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compartilhando...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Companies;
