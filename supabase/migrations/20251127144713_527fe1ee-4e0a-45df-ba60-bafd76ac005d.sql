-- Tabela de avisos/comunicações do sistema
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  created_by UUID REFERENCES public.profiles(id),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'clients', 'team', 'specific_company')),
  target_company_id UUID REFERENCES public.companies(id),
  notify_bell BOOLEAN NOT NULL DEFAULT true,
  notify_page BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar avisos
CREATE POLICY "Admins podem gerenciar avisos"
ON public.announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Team members podem ver avisos para team ou todos
CREATE POLICY "Team members veem avisos relevantes"
ON public.announcements
FOR SELECT
USING (
  has_role(auth.uid(), 'team_member'::app_role) AND 
  active = true AND
  (expires_at IS NULL OR expires_at > now()) AND
  target_type IN ('all', 'team')
);

-- Clientes veem avisos para clientes, todos, ou sua empresa específica
CREATE POLICY "Clientes veem avisos relevantes"
ON public.announcements
FOR SELECT
USING (
  (has_role(auth.uid(), 'client_admin'::app_role) OR has_role(auth.uid(), 'client_user'::app_role)) AND
  active = true AND
  (expires_at IS NULL OR expires_at > now()) AND
  (
    target_type = 'all' OR 
    target_type = 'clients' OR 
    (target_type = 'specific_company' AND is_company_user(auth.uid(), target_company_id))
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();