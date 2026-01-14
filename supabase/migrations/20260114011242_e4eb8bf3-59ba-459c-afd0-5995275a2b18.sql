-- Add can_access_daylog column to profiles table
ALTER TABLE public.profiles ADD COLUMN can_access_daylog boolean NOT NULL DEFAULT true;

-- Create daylog_tags table for dynamic tag management
CREATE TABLE public.daylog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  bg_color text DEFAULT '#f3f4f6',
  text_color text DEFAULT '#374151',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS on daylog_tags
ALTER TABLE public.daylog_tags ENABLE ROW LEVEL SECURITY;

-- Everyone can read active tags
CREATE POLICY "Todos podem ver tags ativas"
ON public.daylog_tags
FOR SELECT
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage tags
CREATE POLICY "Admins podem gerenciar tags"
ON public.daylog_tags
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default tags based on existing DAYLOG_TAGS constant
INSERT INTO public.daylog_tags (name, bg_color, text_color) VALUES
  ('Reunião', '#dbeafe', '#1e40af'),
  ('Planejamento', '#dcfce7', '#166534'),
  ('Desenvolvimento', '#fef3c7', '#92400e'),
  ('Suporte', '#fce7f3', '#9d174d'),
  ('Análise', '#e0e7ff', '#4338ca'),
  ('Documentação', '#f3e8ff', '#7c3aed'),
  ('Treinamento', '#ccfbf1', '#0d9488'),
  ('Review', '#fee2e2', '#991b1b');