import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
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
import { Users as UsersIcon, Plus, Pencil, Trash2, Search, UserPlus, Camera, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface UserWithRole {
  id: string;
  full_name: string;
  avatar_url: string | null;
  roles: { role: string; company_id: string | null; company_name?: string }[];
  teams?: { team_id: string; team_name: string }[];
}

interface Company {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  team_member: 'Membro da Equipe',
  client_admin: 'Admin do Cliente',
  client_user: 'Usuário do Cliente',
};

const Users = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add role dialog
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newRoleCompany, setNewRoleCompany] = useState<string | null>(null);
  
  // Edit user dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Invite user dialog
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteCompany, setInviteCompany] = useState<string | null>(null);
  const [inviteTeam, setInviteTeam] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  // Add to team dialog
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [selectedUserForTeam, setSelectedUserForTeam] = useState<UserWithRole | null>(null);
  const [newTeamId, setNewTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchTeams();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, company_id');

      if (rolesError) throw rolesError;

      // Fetch all team memberships
      const { data: teamMemberships, error: teamMembershipsError } = await supabase
        .from('team_members')
        .select('user_id, team_id');

      if (teamMembershipsError) throw teamMembershipsError;

      // Fetch company names for roles
      const companyIds = [...new Set(roles?.filter(r => r.company_id).map(r => r.company_id))];
      let companiesMap: Record<string, string> = {};
      
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);
        
        companiesData?.forEach(c => {
          companiesMap[c.id] = c.name;
        });
      }

      // Fetch team names
      const teamIds = [...new Set(teamMemberships?.map(tm => tm.team_id))];
      let teamsMap: Record<string, string> = {};
      
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        
        teamsData?.forEach(t => {
          teamsMap[t.id] = t.name;
        });
      }

      // Combine profiles with roles and teams
      const usersWithRoles: UserWithRole[] = profiles?.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        roles: roles
          ?.filter(r => r.user_id === profile.id)
          .map(r => ({
            role: r.role,
            company_id: r.company_id,
            company_name: r.company_id ? companiesMap[r.company_id] : undefined,
          })) || [],
        teams: teamMemberships
          ?.filter(tm => tm.user_id === profile.id)
          .map(tm => ({
            team_id: tm.team_id,
            team_name: teamsMap[tm.team_id] || 'Equipe desconhecida',
          })) || [],
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
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

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .order('name');
    
    if (data) setTeams(data);
  };

  const handleAddRole = async () => {
    if (!selectedUserForRole || !newRole) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUserForRole.id,
          role: newRole as 'admin' | 'team_member' | 'client_admin' | 'client_user',
          company_id: newRoleCompany || null,
        });

      if (error) throw error;

      toast({
        title: 'Função adicionada',
        description: `Função ${roleLabels[newRole]} adicionada ao usuário.`,
      });

      setIsRoleDialogOpen(false);
      setSelectedUserForRole(null);
      setNewRole('');
      setNewRoleCompany(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar função',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: string, companyId: string | null) => {
    try {
      let query = supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as 'admin' | 'team_member' | 'client_admin' | 'client_user');

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null);
      }

      const { error } = await query;

      if (error) throw error;

      toast({
        title: 'Função removida',
        description: 'A função foi removida do usuário.',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover função',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTeamMember = async (userId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('user_id', userId)
        .eq('team_id', teamId);

      if (error) throw error;

      toast({
        title: 'Removido da equipe',
        description: 'O usuário foi removido da equipe.',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover da equipe',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddToTeam = async () => {
    if (!selectedUserForTeam || !newTeamId) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          user_id: selectedUserForTeam.id,
          team_id: newTeamId,
        });

      if (error) throw error;

      toast({
        title: 'Adicionado à equipe',
        description: 'O usuário foi adicionado à equipe.',
      });

      setIsTeamDialogOpen(false);
      setSelectedUserForTeam(null);
      setNewTeamId(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar à equipe',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Edit user handlers
  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditAvatarPreview(user.avatar_url);
    setEditAvatarFile(null);
    setIsEditDialogOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingUser || !editFullName.trim()) return;

    setIsSavingProfile(true);
    try {
      let avatarUrl = editingUser.avatar_url;

      // Upload new avatar if selected
      if (editAvatarFile) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const fileName = `${editingUser.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editAvatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = urlData.publicUrl;
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado',
        description: 'Os dados do usuário foram atualizados com sucesso.',
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Invite user handler
  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha email e nome completo.',
        variant: 'destructive',
      });
      return;
    }

    setIsInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail.trim(),
          fullName: inviteFullName.trim(),
          role: inviteRole || null,
          companyId: inviteCompany || null,
          teamId: inviteTeam || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao convidar usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Usuário convidado',
        description: response.data?.message || `Um email foi enviado para ${inviteEmail} com instruções para definir a senha.`,
      });

      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('');
      setInviteCompany(null);
      setInviteTeam(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao convidar usuário',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UsersIcon className="h-8 w-8" />
              Usuários
            </h1>
            <p className="text-muted-foreground">
              Gerencie os usuários e suas permissões.
            </p>
          </div>
          
          {/* Invite User Button */}
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
                <DialogDescription>
                  O usuário receberá um email para definir sua senha e acessar o sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Nome Completo *</Label>
                  <Input
                    id="invite-name"
                    placeholder="Nome do usuário"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função (opcional)</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="team_member">Membro da Equipe</SelectItem>
                      <SelectItem value="client_admin">Admin do Cliente</SelectItem>
                      <SelectItem value="client_user">Usuário do Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(inviteRole === 'client_admin' || inviteRole === 'client_user') && (
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select 
                      value={inviteCompany || ''} 
                      onValueChange={(v) => setInviteCompany(v || null)}
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

                {inviteRole === 'team_member' && (
                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Select 
                      value={inviteTeam || ''} 
                      onValueChange={(v) => setInviteTeam(v || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      A equipe determina quais empresas/clientes o usuário pode acessar.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInviteUser} disabled={isInviting || !inviteEmail || !inviteFullName}>
                  {isInviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar Convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Usuários</CardTitle>
                <CardDescription>
                  {users.length} usuário(s) cadastrado(s)
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
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
                Carregando usuários...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Funções</TableHead>
                    <TableHead>Equipes</TableHead>
                    <TableHead className="w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {user.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              Sem funções
                            </span>
                          ) : (
                            user.roles.map((r, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground group"
                                onClick={() => handleRemoveRole(user.id, r.role, r.company_id)}
                              >
                                {roleLabels[r.role]}
                                {r.company_name && ` (${r.company_name})`}
                                <Trash2 className="h-3 w-3 ml-1 hidden group-hover:inline" />
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(!user.teams || user.teams.length === 0) ? (
                            <span className="text-muted-foreground text-sm">
                              Nenhuma equipe
                            </span>
                          ) : (
                            user.teams.map((t, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground group"
                                onClick={() => handleRemoveTeamMember(user.id, t.team_id)}
                              >
                                {t.team_name}
                                <Trash2 className="h-3 w-3 ml-1 hidden group-hover:inline" />
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Edit Profile Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          {/* Add Role Button */}
                          <Dialog 
                            open={isRoleDialogOpen && selectedUserForRole?.id === user.id} 
                            onOpenChange={(open) => {
                              setIsRoleDialogOpen(open);
                              if (!open) {
                                setSelectedUserForRole(null);
                                setNewRole('');
                                setNewRoleCompany(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUserForRole(user)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adicionar Função</DialogTitle>
                                <DialogDescription>
                                  Adicione uma nova função para {user.full_name}.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Função</Label>
                                  <Select value={newRole} onValueChange={setNewRole}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma função" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Administrador</SelectItem>
                                      <SelectItem value="team_member">Membro da Equipe</SelectItem>
                                      <SelectItem value="client_admin">Admin do Cliente</SelectItem>
                                      <SelectItem value="client_user">Usuário do Cliente</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {(newRole === 'client_admin' || newRole === 'client_user') && (
                                  <div className="space-y-2">
                                    <Label>Empresa</Label>
                                    <Select 
                                      value={newRoleCompany || ''} 
                                      onValueChange={(v) => setNewRoleCompany(v || null)}
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
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleAddRole} disabled={!newRole}>
                                  Adicionar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          
                          {/* Add to Team Button */}
                          <Dialog 
                            open={isTeamDialogOpen && selectedUserForTeam?.id === user.id} 
                            onOpenChange={(open) => {
                              setIsTeamDialogOpen(open);
                              if (!open) {
                                setSelectedUserForTeam(null);
                                setNewTeamId(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUserForTeam(user)}
                                title="Adicionar à equipe"
                              >
                                <UsersIcon className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adicionar à Equipe</DialogTitle>
                                <DialogDescription>
                                  Adicione {user.full_name} a uma equipe.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Equipe</Label>
                                  <Select value={newTeamId || ''} onValueChange={(v) => setNewTeamId(v || null)}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma equipe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {teams.filter(t => !user.teams?.some(ut => ut.team_id === t.id)).map((team) => (
                                        <SelectItem key={team.id} value={team.id}>
                                          {team.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleAddToTeam} disabled={!newTeamId}>
                                  Adicionar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            setEditAvatarFile(null);
            setEditAvatarPreview(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do perfil do usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={editAvatarPreview || undefined} />
                    <AvatarFallback className="text-2xl">
                      {editFullName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Clique no ícone para alterar a foto
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile || !editFullName.trim()}>
                {isSavingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Users;
