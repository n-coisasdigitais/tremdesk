import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Calendar, 
  User, 
  Tag, 
  Search,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  Building2
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useDayLogs, DayLog as DayLogType } from '@/hooks/useDayLogs';
import { useDayLogTags } from '@/hooks/useDayLogTags';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function DayLog() {
  const navigate = useNavigate();
  const { dayLogs, loading, fetchDayLogs } = useDayLogs();
  const { tags: dynamicTags, getTagColors } = useDayLogTags();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    fetchTeamMembers();
    fetchCompanies();
  }, []);

  useEffect(() => {
    const filters: { date?: string; userId?: string; tags?: string[]; companyId?: string } = {};
    
    if (selectedDate) {
      filters.date = format(selectedDate, 'yyyy-MM-dd');
    }
    if (selectedUser && selectedUser !== 'all') {
      filters.userId = selectedUser;
    }
    if (selectedCompany && selectedCompany !== 'all') {
      filters.companyId = selectedCompany;
    }
    if (selectedTags.length > 0) {
      filters.tags = selectedTags;
    }
    
    fetchDayLogs(Object.keys(filters).length > 0 ? filters : undefined);
  }, [selectedDate, selectedUser, selectedCompany, selectedTags]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .order('full_name');
    
    if (data) setTeamMembers(data);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    
    if (data) setCompanies(data);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedDate(undefined);
    setSelectedUser('all');
    setSelectedCompany('all');
    setSelectedTags([]);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DayLog</h1>
            <p className="text-muted-foreground">Diário operacional da equipe</p>
          </div>
          <Button onClick={() => navigate('/daylog/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo DayLog
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                {/* Date Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 min-w-[180px] justify-start">
                      <Calendar className="h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Filtrar por data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                {/* User Filter */}
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-[200px]">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filtrar por colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os colaboradores</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Company Filter */}
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filtrar por empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {(selectedDate || selectedUser !== 'all' || selectedCompany !== 'all' || selectedTags.length > 0) && (
                  <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Tags Filter */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground mr-2 flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  Tags:
                </span>
                {dynamicTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className={cn(
                        'cursor-pointer transition-all',
                        isSelected 
                          ? 'border-transparent' 
                          : 'hover:bg-muted'
                      )}
                      style={isSelected ? { backgroundColor: tag.bg_color, color: tag.text_color } : {}}
                      onClick={() => toggleTag(tag.name)}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DayLog List */}
        <div className="space-y-4">
          {loading ? (
            // Loading skeleton
            [...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : dayLogs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-foreground mb-1">Nenhum DayLog encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedDate || selectedUser !== 'all' || selectedCompany !== 'all' || selectedTags.length > 0
                    ? 'Tente ajustar os filtros ou crie um novo registro'
                    : 'Comece registrando suas atividades do dia'}
                </p>
                <Button onClick={() => navigate('/daylog/new')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar DayLog
                </Button>
              </CardContent>
            </Card>
          ) : (
            dayLogs.map((log) => (
              <DayLogCard 
                key={log.id} 
                log={log} 
                onClick={() => navigate(`/daylog/${log.id}`)}
                getInitials={getInitials}
                getTagColors={getTagColors}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

interface DayLogCardProps {
  log: DayLogType;
  onClick: () => void;
  getInitials: (name: string) => string;
  getTagColors: (tagName: string) => { bg: string; text: string };
}

function DayLogCard({ log, onClick, getInitials, getTagColors }: DayLogCardProps) {
  const profile = log.profiles;
  const previewText = log.work_done.slice(0, 150) + (log.work_done.length > 150 ? '...' : '');

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {profile?.full_name ? getInitials(profile.full_name) : '?'}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {profile?.full_name || 'Usuário'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(log.date), "dd 'de' MMMM", { locale: ptBR })}
                </span>
                {/* Company indicator */}
                {log.company && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                    <Building2 className="h-3 w-3" />
                    {log.company.name}
                  </span>
                )}
              </div>
              
              {/* Indicators */}
              <div className="flex items-center gap-2">
                {log.transcription_url && (
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                )}
                {log.google_doc_url && (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Description/Preview */}
            {log.description && (
              <p className="text-sm font-medium text-foreground mb-1">
                {log.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {previewText}
            </p>

            {/* Tags */}
            {log.tags && log.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {log.tags.map((tag) => {
                  const colors = getTagColors(tag);
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
