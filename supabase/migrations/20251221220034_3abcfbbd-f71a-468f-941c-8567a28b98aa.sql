-- ==========================================
-- FASE 2: Sistema de Categorias Dinâmico
-- ==========================================

-- Tabela de categorias customizáveis
CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT '📋',
  color text DEFAULT '#6366f1',
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Tabela de associação ticket-categorias (múltiplas categorias por ticket)
CREATE TABLE public.ticket_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.ticket_categories(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(ticket_id, category_id)
);

-- ==========================================
-- FASE 3: Sistema de Watchers/Cópia (CC)
-- ==========================================

-- Tabela de observadores do ticket
CREATE TABLE public.ticket_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- ==========================================
-- FASE 4: Sistema de Aprovações Avançado
-- ==========================================

-- Adicionar campos de aprovação ao ticket
ALTER TABLE public.tickets 
ADD COLUMN requires_approval boolean DEFAULT false,
ADD COLUMN approval_assignee uuid REFERENCES public.profiles(id);

-- Tabela de itens de aprovação (imagens, arquivos para aprovar)
CREATE TABLE public.approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested')),
  feedback text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Tabela de pendências de cada item de aprovação
CREATE TABLE public.approval_item_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_item_id uuid REFERENCES public.approval_items(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- ==========================================
-- RLS Policies
-- ==========================================

-- Enable RLS
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_item_issues ENABLE ROW LEVEL SECURITY;

-- ticket_categories policies
CREATE POLICY "Todos podem ver categorias ativas"
ON public.ticket_categories FOR SELECT
USING (active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem gerenciar categorias"
ON public.ticket_categories FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- ticket_category_assignments policies
CREATE POLICY "Usuários veem categorias de tickets que têm acesso"
ON public.ticket_category_assignments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = ticket_category_assignments.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id))
    OR is_company_user(auth.uid(), tickets.company_id))
));

CREATE POLICY "Admins e team members podem gerenciar categorias de tickets"
ON public.ticket_category_assignments FOR ALL
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = ticket_category_assignments.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id)))
));

-- ticket_watchers policies
CREATE POLICY "Usuários veem watchers de tickets que têm acesso"
ON public.ticket_watchers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = ticket_watchers.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id))
    OR is_company_user(auth.uid(), tickets.company_id))
));

CREATE POLICY "Admins e team members podem gerenciar watchers"
ON public.ticket_watchers FOR ALL
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = ticket_watchers.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id)))
));

-- approval_items policies
CREATE POLICY "Usuários veem itens de aprovação de tickets que têm acesso"
ON public.approval_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = approval_items.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id))
    OR is_company_user(auth.uid(), tickets.company_id))
));

CREATE POLICY "Admins e team members podem criar itens de aprovação"
ON public.approval_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = approval_items.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id)))
));

CREATE POLICY "Usuários com acesso podem atualizar itens de aprovação"
ON public.approval_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = approval_items.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id))
    OR is_company_user(auth.uid(), tickets.company_id))
));

CREATE POLICY "Admins e team members podem deletar itens de aprovação"
ON public.approval_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM tickets 
  WHERE tickets.id = approval_items.ticket_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), tickets.company_id)))
));

-- approval_item_issues policies
CREATE POLICY "Usuários veem issues de itens que têm acesso"
ON public.approval_item_issues FOR SELECT
USING (EXISTS (
  SELECT 1 FROM approval_items ai
  JOIN tickets t ON t.id = ai.ticket_id
  WHERE ai.id = approval_item_issues.approval_item_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), t.company_id))
    OR is_company_user(auth.uid(), t.company_id))
));

CREATE POLICY "Clientes podem criar issues"
ON public.approval_item_issues FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM approval_items ai
  JOIN tickets t ON t.id = ai.ticket_id
  WHERE ai.id = approval_item_issues.approval_item_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), t.company_id))
    OR is_company_user(auth.uid(), t.company_id))
));

CREATE POLICY "Usuários com acesso podem atualizar issues"
ON public.approval_item_issues FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM approval_items ai
  JOIN tickets t ON t.id = ai.ticket_id
  WHERE ai.id = approval_item_issues.approval_item_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), t.company_id))
    OR is_company_user(auth.uid(), t.company_id))
));

CREATE POLICY "Admins e team members podem deletar issues"
ON public.approval_item_issues FOR DELETE
USING (EXISTS (
  SELECT 1 FROM approval_items ai
  JOIN tickets t ON t.id = ai.ticket_id
  WHERE ai.id = approval_item_issues.approval_item_id 
  AND (has_role(auth.uid(), 'admin') 
    OR (has_role(auth.uid(), 'team_member') AND team_has_access(auth.uid(), t.company_id)))
));

-- ==========================================
-- Inserir categorias padrão
-- ==========================================

INSERT INTO public.ticket_categories (name, icon, color) VALUES
('Meta Ads', '📱', '#1877F2'),
('Google Ads', '🔍', '#4285F4'),
('LinkedIn Ads', '💼', '#0A66C2'),
('Arte', '🎨', '#E91E63'),
('Relatório', '📊', '#9C27B0'),
('Outro', '📋', '#607D8B');

-- ==========================================
-- Enable Realtime for new tables
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_category_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_watchers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_item_issues;