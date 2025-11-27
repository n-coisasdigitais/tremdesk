import { useState, useEffect } from 'react';
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
import { Users as UsersIcon, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface UserWithRole {
  id: string;
  full_name: string;
  avatar_url: string | null;
  roles: { role: string; company_id: string | null; company_name?: string }[];
}

interface Company {
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
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newRoleCompany, setNewRoleCompany] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
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

      // Combine profiles with roles
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

  const handleAddRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.id,
          role: newRole as 'admin' | 'team_member' | 'client_admin' | 'client_user',
          company_id: newRoleCompany || null,
        });

      if (error) throw error;

      toast({
        title: 'Função adicionada',
        description: `Função ${roleLabels[newRole]} adicionada ao usuário.`,
      });

      setIsDialogOpen(false);
      setSelectedUser(null);
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

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                    <TableHead className="w-[100px]">Ações</TableHead>
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
                        <Dialog open={isDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (!open) {
                            setSelectedUser(null);
                            setNewRole('');
                            setNewRoleCompany(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(user)}
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
                              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleAddRole} disabled={!newRole}>
                                Adicionar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Users;
