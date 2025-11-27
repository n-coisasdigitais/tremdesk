import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Building2,
  Settings,
  LogOut,
  Bell,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  id: string;
  type: string;
  ticket_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, isAdmin, isTeamMember } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to new notifications
      const channel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read_at).length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    fetchNotifications();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'mention':
        return 'Você foi mencionado em uma demanda';
      case 'comment':
        return 'Novo comentário em sua demanda';
      case 'status_change':
        return 'Status da demanda alterado';
      case 'approval':
        return 'Demanda aprovada';
      case 'changes_requested':
        return 'Alterações solicitadas';
      case 'new_ticket':
        return 'Nova demanda criada';
      default:
        return 'Nova notificação';
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/kanban', label: 'Demandas', icon: KanbanSquare, show: true },
    { path: '/reports', label: 'Relatórios', icon: BarChart3, show: true },
    { path: '/teams', label: 'Times', icon: Users, show: isAdmin },
    { path: '/companies', label: 'Empresas', icon: Building2, show: isAdmin || isTeamMember },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/dashboard" className="mr-6 flex items-center space-x-2">
              <KanbanSquare className="h-6 w-6" />
              <span className="hidden font-bold sm:inline-block">
                Sistema de Demandas
              </span>
            </a>
          </div>

          <nav className="flex items-center space-x-6 text-sm font-medium flex-1">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center space-x-2 transition-colors hover:text-foreground/80 ${
                    isActive ? 'text-foreground' : 'text-foreground/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                  <h4 className="font-semibold">Notificações</h4>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                      Marcar todas como lidas
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-72">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nenhuma notificação
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            markAsRead(notification.id);
                            if (notification.ticket_id) {
                              navigate('/kanban');
                            }
                          }}
                          className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                            !notification.read_at ? 'bg-primary/5' : ''
                          }`}
                        >
                          <p className="text-sm font-medium">
                            {getNotificationText(notification)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name} />
                    <AvatarFallback>
                      {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                    <div className="flex gap-1 mt-1">
                      {isAdmin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                      {isTeamMember && <Badge variant="secondary" className="text-xs">Equipe</Badge>}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {children}
      </main>
    </div>
  );
};
