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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Users, Plus, Pencil, Trash2, Search, Building2, UserPlus } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface TeamMember {
  id: string;
  user_id: string;
  profile: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface TeamClient {
  id: string;
  company_id: string;
  company: {
    name: string;
    logo_url: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  created_at: string;
  members: TeamMember[];
  clients: TeamClient[];
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

const Teams = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
    fetchCompanies();
  }, []);

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) throw teamsError;

      // Fetch members and clients for each team
      const teamsWithRelations: Team[] = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: membersData } = await supabase
            .from('team_members')
            .select('id, user_id')
            .eq('team_id', team.id);

          const memberProfiles = await Promise.all(
            (membersData || []).map(async (member) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', member.user_id)
                .maybeSingle();
              
              return {
                id: member.id,
                user_id: member.user_id,
                profile,
              };
            })
          );

          const { data: clientsData } = await supabase
            .from('team_clients')
            .select('id, company_id')
            .eq('team_id', team.id);

          const clientCompanies = await Promise.all(
            (clientsData || []).map(async (client) => {
              const { data: company } = await supabase
                .from('companies')
                .select('name, logo_url')
                .eq('id', client.company_id)
                .maybeSingle();
              
              return {
                id: client.id,
                company_id: client.company_id,
                company,
              };
            })
          );

          return {
            ...team,
            members: memberProfiles,
            clients: clientCompanies,
          };
        })
      );

      setTeams(teamsWithRelations);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar times',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .order('full_name');
    
    if (data) setProfiles(data);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .order('name');
    
    if (data) setCompanies(data);
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome do time é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update({ name: teamName })
          .eq('id', editingTeam.id);

        if (error) throw error;

        toast({
          title: 'Time atualizado',
          description: 'O nome do time foi alterado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('teams')
          .insert({ name: teamName });

        if (error) throw error;

        toast({
          title: 'Time criado',
          description: 'O novo time foi cadastrado com sucesso.',
        });
      }

      setIsTeamDialogOpen(false);
      setTeamName('');
      setEditingTeam(null);
      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar time',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Tem certeza que deseja excluir este time?')) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: 'Time excluído',
        description: 'O time foi removido com sucesso.',
      });

      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir time',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedMember) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: selectedTeam.id,
          user_id: selectedMember,
        });

      if (error) throw error;

      toast({
        title: 'Membro adicionado',
        description: 'O membro foi adicionado ao time.',
      });

      setIsMemberDialogOpen(false);
      setSelectedMember('');
      setSelectedTeam(null);
      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar membro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Membro removido',
        description: 'O membro foi removido do time.',
      });

      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover membro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddClient = async () => {
    if (!selectedTeam || !selectedClient) return;

    try {
      const { error } = await supabase
        .from('team_clients')
        .insert({
          team_id: selectedTeam.id,
          company_id: selectedClient,
        });

      if (error) throw error;

      toast({
        title: 'Cliente adicionado',
        description: 'O cliente foi atribuído ao time.',
      });

      setIsClientDialogOpen(false);
      setSelectedClient('');
      setSelectedTeam(null);
      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar cliente',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('team_clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: 'Cliente removido',
        description: 'O cliente foi removido do time.',
      });

      fetchTeams();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover cliente',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Users className="h-8 w-8" />
              Times
            </h1>
            <p className="text-muted-foreground">
              Gerencie os times e suas atribuições de clientes.
            </p>
          </div>
          <Button onClick={() => {
            setEditingTeam(null);
            setTeamName('');
            setIsTeamDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Time
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Times</CardTitle>
                <CardDescription>
                  {teams.length} time(s) cadastrado(s)
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar time..."
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
                Carregando times...
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum time cadastrado.
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filteredTeams.map((team) => (
                  <AccordionItem key={team.id} value={team.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{team.name}</span>
                          <Badge variant="secondary">
                            {team.members.length} membro(s)
                          </Badge>
                          <Badge variant="outline">
                            {team.clients.length} cliente(s)
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {/* Team Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTeam(team);
                              setTeamName(team.name);
                              setIsTeamDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar Nome
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTeam(team);
                              setIsMemberDialogOpen(true);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Adicionar Membro
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTeam(team);
                              setIsClientDialogOpen(true);
                            }}
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Atribuir Cliente
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Time
                          </Button>
                        </div>

                        {/* Members Section */}
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Membros
                          </h4>
                          {team.members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhum membro no time.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {team.members.map((member) => (
                                <Badge
                                  key={member.id}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground group pl-1"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <Avatar className="h-5 w-5 mr-1">
                                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {member.profile?.full_name?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {member.profile?.full_name || 'Usuário'}
                                  <Trash2 className="h-3 w-3 ml-1 hidden group-hover:inline" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Clients Section */}
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Clientes Atribuídos
                          </h4>
                          {team.clients.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhum cliente atribuído.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {team.clients.map((client) => (
                                <Badge
                                  key={client.id}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground group pl-1"
                                  onClick={() => handleRemoveClient(client.id)}
                                >
                                  <Avatar className="h-5 w-5 mr-1">
                                    <AvatarImage src={client.company?.logo_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {client.company?.name?.charAt(0) || 'E'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {client.company?.name || 'Empresa'}
                                  <Trash2 className="h-3 w-3 ml-1 hidden group-hover:inline" />
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Team Dialog */}
        <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? 'Editar Time' : 'Novo Time'}
              </DialogTitle>
              <DialogDescription>
                {editingTeam
                  ? 'Altere o nome do time.'
                  : 'Crie um novo time para gerenciar clientes.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Nome do Time</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Time de Performance"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTeam}>
                {editingTeam ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Member Dialog */}
        <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Membro</DialogTitle>
              <DialogDescription>
                Adicione um usuário ao time {selectedTeam?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter(p => !selectedTeam?.members.some(m => m.user_id === p.id))
                      .map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddMember} disabled={!selectedMember}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Client Dialog */}
        <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir Cliente</DialogTitle>
              <DialogDescription>
                Atribua uma empresa ao time {selectedTeam?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies
                      .filter(c => !selectedTeam?.clients.some(cl => cl.company_id === c.id))
                      .map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddClient} disabled={!selectedClient}>
                Atribuir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Teams;
