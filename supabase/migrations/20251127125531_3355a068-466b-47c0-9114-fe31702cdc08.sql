-- Tabela para vincular demandas entre si
CREATE TABLE public.ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'related',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(source_ticket_id, target_ticket_id),
  CHECK (source_ticket_id != target_ticket_id)
);

-- Tabela para checklist/sub-itens das demandas
CREATE TABLE public.ticket_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar campos para Google Drive nas empresas
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Adicionar campos para Google Drive nos anexos
ALTER TABLE public.ticket_attachments 
  ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Enable RLS
ALTER TABLE public.ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ticket_links
CREATE POLICY "Usuários veem links de tickets que têm acesso"
ON public.ticket_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_links.source_ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
      OR is_company_user(auth.uid(), tickets.company_id)
    )
  )
);

CREATE POLICY "Admins e team members podem criar links"
ON public.ticket_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = source_ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
    )
  )
);

CREATE POLICY "Admins e team members podem deletar links"
ON public.ticket_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_links.source_ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
    )
  )
);

-- RLS Policies para ticket_checklist_items
CREATE POLICY "Usuários veem checklist de tickets que têm acesso"
ON public.ticket_checklist_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_checklist_items.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
      OR is_company_user(auth.uid(), tickets.company_id)
    )
  )
);

CREATE POLICY "Usuários com acesso podem criar checklist items"
ON public.ticket_checklist_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
      OR is_company_user(auth.uid(), tickets.company_id)
    )
  )
);

CREATE POLICY "Usuários com acesso podem atualizar checklist items"
ON public.ticket_checklist_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_checklist_items.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
      OR is_company_user(auth.uid(), tickets.company_id)
    )
  )
);

CREATE POLICY "Usuários com acesso podem deletar checklist items"
ON public.ticket_checklist_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_checklist_items.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
      OR is_company_user(auth.uid(), tickets.company_id)
    )
  )
);