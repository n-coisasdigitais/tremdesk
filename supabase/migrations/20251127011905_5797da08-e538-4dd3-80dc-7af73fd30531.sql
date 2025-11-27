-- Sistema de Gestão de Demandas - Migration Completa

-- 1. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'team_member', 'client_admin', 'client_user');

-- 2. Criar enum para status das demandas
CREATE TYPE public.ticket_status AS ENUM ('novo', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'concluido', 'cancelado');

-- 3. Criar enum para prioridade
CREATE TYPE public.ticket_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- 4. Criar enum para categoria
CREATE TYPE public.ticket_category AS ENUM ('meta_ads', 'google_ads', 'linkedin_ads', 'arte', 'relatorio', 'outro');

-- 5. Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role, company_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. Tabela de empresas
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  leads_system_url TEXT,
  assas_portal_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 8. Tabela de times
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 9. Tabela de membros do time
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 10. Tabela de clientes atribuídos aos times
CREATE TABLE public.team_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, company_id)
);

ALTER TABLE public.team_clients ENABLE ROW LEVEL SECURITY;

-- 11. Tabela de tickets (demandas)
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description_json JSONB,
  category public.ticket_category NOT NULL,
  priority public.ticket_priority DEFAULT 'media' NOT NULL,
  status public.ticket_status DEFAULT 'novo' NOT NULL,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX idx_tickets_company_id ON public.tickets(company_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);

-- 12. Tabela de comentários
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_json JSONB NOT NULL,
  parent_comment_id UUID REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

-- 13. Tabela de anexos
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- 14. Tabela de atividades (log)
CREATE TABLE public.ticket_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ticket_activities_ticket_id ON public.ticket_activities(ticket_id);

-- 15. Tabela de menções
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mentions_mentioned_user_id ON public.mentions(mentioned_user_id);

-- 16. Tabela de notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  reference_id UUID,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- 17. Tabela de aprovações
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  feedback_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- 18. Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 19. Função para verificar se usuário é da empresa
CREATE OR REPLACE FUNCTION public.is_company_user(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;

-- 20. Função para verificar se team member tem acesso à empresa
CREATE OR REPLACE FUNCTION public.team_has_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_clients tc
    JOIN public.team_members tm ON tc.team_id = tm.team_id
    WHERE tm.user_id = _user_id
      AND tc.company_id = _company_id
  )
$$;

-- 21. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 22. Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_comments_updated_at
BEFORE UPDATE ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 23. Trigger para criar perfil quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 24. RLS Policies

-- Profiles: todos podem ver, usuários podem atualizar próprio perfil
CREATE POLICY "Profiles são visíveis por todos" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- User Roles: apenas admins gerenciam
CREATE POLICY "Admins podem gerenciar roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem ver próprios roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Companies: admins e team members veem todas, clientes veem apenas a sua
CREATE POLICY "Admins veem todas empresas" ON public.companies
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members veem empresas atribuídas" ON public.companies
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_member') AND
    public.team_has_access(auth.uid(), id)
  );

CREATE POLICY "Clientes veem própria empresa" ON public.companies
  FOR SELECT USING (
    public.is_company_user(auth.uid(), id)
  );

CREATE POLICY "Admins podem inserir empresas" ON public.companies
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar empresas" ON public.companies
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Teams: apenas admins gerenciam
CREATE POLICY "Admins gerenciam times" ON public.teams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members veem próprios times" ON public.teams
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_member') AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = teams.id AND user_id = auth.uid()
    )
  );

-- Team Members
CREATE POLICY "Admins gerenciam membros" ON public.team_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Team Clients
CREATE POLICY "Admins gerenciam atribuições" ON public.team_clients
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tickets: regras complexas baseadas em role
CREATE POLICY "Admins veem todos tickets" ON public.tickets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members veem tickets de empresas atribuídas" ON public.tickets
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_member') AND
    public.team_has_access(auth.uid(), company_id)
  );

CREATE POLICY "Clientes veem tickets da própria empresa" ON public.tickets
  FOR SELECT USING (
    public.is_company_user(auth.uid(), company_id)
  );

CREATE POLICY "Clientes podem criar tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    public.is_company_user(auth.uid(), company_id)
  );

CREATE POLICY "Admins e team members podem criar tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id))
  );

CREATE POLICY "Admins e team members podem atualizar tickets" ON public.tickets
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id))
  );

-- Comments
CREATE POLICY "Usuários veem comentários de tickets que têm acesso" ON public.ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "Usuários podem criar comentários" ON public.ticket_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

-- Attachments
CREATE POLICY "Usuários veem anexos de tickets que têm acesso" ON public.ticket_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "Usuários podem criar anexos" ON public.ticket_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

-- Activities
CREATE POLICY "Usuários veem atividades de tickets que têm acesso" ON public.ticket_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "Sistema pode criar atividades" ON public.ticket_activities
  FOR INSERT WITH CHECK (true);

-- Mentions
CREATE POLICY "Usuários veem próprias menções" ON public.mentions
  FOR SELECT USING (auth.uid() = mentioned_user_id);

CREATE POLICY "Sistema pode criar menções" ON public.mentions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários podem marcar menções como lidas" ON public.mentions
  FOR UPDATE USING (auth.uid() = mentioned_user_id);

-- Notifications
CREATE POLICY "Usuários veem próprias notificações" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode criar notificações" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários podem marcar notificações como lidas" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Approvals
CREATE POLICY "Usuários veem aprovações de tickets que têm acesso" ON public.approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND (
        public.has_role(auth.uid(), 'admin') OR
        (public.has_role(auth.uid(), 'team_member') AND public.team_has_access(auth.uid(), company_id)) OR
        public.is_company_user(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "Clientes podem criar aprovações" ON public.approvals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id AND public.is_company_user(auth.uid(), company_id)
    )
  );

-- 25. Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('attachments', 'attachments', false),
  ('company_logos', 'company_logos', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para attachments (privado)
CREATE POLICY "Usuários podem fazer upload de anexos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Usuários veem anexos de tickets que têm acesso"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments' AND
  auth.uid() IS NOT NULL
);

-- Storage policies para company_logos (público)
CREATE POLICY "Logos são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company_logos');

CREATE POLICY "Admins podem fazer upload de logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company_logos' AND
  public.has_role(auth.uid(), 'admin')
);

-- Storage policies para avatars (público)
CREATE POLICY "Avatars são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Usuários podem fazer upload do próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem atualizar próprio avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);