import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { StaticLogo } from '@/components/AnimatedLogo';
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  Users,
  UserCog,
  Settings,
  ChevronRight,
  KanbanSquare,
  Megaphone,
  BookOpen,
  Contact,
  Tags,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isTeamMember, canAccessDaylog } = useAuth();

  const mainItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/kanban', label: 'Demandas', icon: KanbanSquare },
    { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  ];

  const internalItems = [
    { path: '/daylog', label: 'DayLog', icon: BookOpen },
  ];

  const adminItems = [
    { path: '/admin/users', label: 'Usuários', icon: UserCog },
    { path: '/admin/companies', label: 'Empresas', icon: Building2 },
    { path: '/admin/teams', label: 'Times', icon: Users },
    { path: '/admin/categories', label: 'Categorias', icon: Tags },
    { path: '/admin/daylog-tags', label: 'Tags DayLog', icon: BookOpen },
    { path: '/admin/contacts', label: 'Contatos', icon: Contact },
    { path: '/admin/announcements', label: 'Avisos', icon: Megaphone },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isAdminActive = adminItems.some(item => isActive(item.path));

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b px-4 py-4">
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-primary"
        >
          <StaticLogo size="sm" />
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.path}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAdmin || isTeamMember) && canAccessDaylog && (
          <SidebarGroup>
            <SidebarGroupLabel>Interno</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {internalItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.path}
                        end
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(isAdmin || isTeamMember) && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/companies"
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <Building2 className="h-4 w-4" />
                      <span>Empresas</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isAdminActive}>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1">
                  <span>Administração</span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.path}
                            end
                            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted"
                            activeClassName="bg-primary/10 text-primary font-medium"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                end
                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-muted"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
