-- Criar tabela principal day_logs
CREATE TABLE public.day_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT,
  work_done TEXT NOT NULL,
  work_pending TEXT,
  next_steps TEXT,
  tags TEXT[] DEFAULT '{}',
  transcription_url TEXT,
  ai_assistant_url TEXT,
  meeting_notes TEXT,
  google_doc_id TEXT,
  google_doc_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de anexos
CREATE TABLE public.day_log_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_log_id UUID NOT NULL REFERENCES public.day_logs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  google_drive_file_id TEXT,
  google_drive_folder_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_log_attachments ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_day_logs_updated_at
  BEFORE UPDATE ON public.day_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS para day_logs
-- Usuários veem seus próprios logs
CREATE POLICY "Usuários veem próprios day_logs"
ON public.day_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Admins e Team Members veem todos os logs (recurso interno)
CREATE POLICY "Admins e team_members veem todos day_logs"
ON public.day_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'team_member'::app_role)
);

-- Usuários criam seus próprios logs
CREATE POLICY "Usuários criam próprios day_logs"
ON public.day_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários editam seus próprios logs
CREATE POLICY "Usuários editam próprios day_logs"
ON public.day_logs
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins podem editar qualquer log
CREATE POLICY "Admins editam todos day_logs"
ON public.day_logs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários deletam seus próprios logs
CREATE POLICY "Usuários deletam próprios day_logs"
ON public.day_logs
FOR DELETE
USING (auth.uid() = user_id);

-- Admins podem deletar qualquer log
CREATE POLICY "Admins deletam todos day_logs"
ON public.day_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para day_log_attachments
-- Ver anexos dos logs que tem acesso
CREATE POLICY "Usuários veem anexos de seus day_logs"
ON public.day_log_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.day_logs
    WHERE day_logs.id = day_log_attachments.day_log_id
    AND (
      day_logs.user_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'team_member'::app_role)
    )
  )
);

-- Criar anexos em logs que tem acesso
CREATE POLICY "Usuários criam anexos em seus day_logs"
ON public.day_log_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.day_logs
    WHERE day_logs.id = day_log_attachments.day_log_id
    AND (
      day_logs.user_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Deletar anexos de logs que tem acesso
CREATE POLICY "Usuários deletam anexos de seus day_logs"
ON public.day_log_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.day_logs
    WHERE day_logs.id = day_log_attachments.day_log_id
    AND (
      day_logs.user_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);