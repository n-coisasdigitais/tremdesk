-- Create error_logs table for system error tracking
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  source TEXT,
  user_id UUID,
  ticket_id UUID,
  company_id UUID,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_error_logs_type ON public.error_logs(type);
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view error logs
CREATE POLICY "Admins podem ver todos os logs de erro"
  ON public.error_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert error logs (any authenticated user can log errors)
CREATE POLICY "Usuários autenticados podem criar logs de erro"
  ON public.error_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can update (mark as resolved)
CREATE POLICY "Admins podem atualizar logs de erro"
  ON public.error_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins podem deletar logs de erro"
  ON public.error_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));