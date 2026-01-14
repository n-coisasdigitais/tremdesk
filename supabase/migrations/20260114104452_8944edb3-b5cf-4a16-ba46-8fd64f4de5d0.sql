-- Table for tracking email sends
CREATE TABLE public.daylog_email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_log_id UUID NOT NULL REFERENCES public.day_logs(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id),
  sent_to TEXT[] NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daylog_email_sends ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can view/create email sends
CREATE POLICY "Admins can view email sends"
ON public.daylog_email_sends
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can create email sends"
ON public.daylog_email_sends
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Table for daylog comments (threads)
CREATE TABLE public.daylog_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_log_id UUID NOT NULL REFERENCES public.day_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content_json JSONB NOT NULL,
  parent_comment_id UUID REFERENCES public.daylog_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daylog_comments ENABLE ROW LEVEL SECURITY;

-- Admins and team_members can view comments
CREATE POLICY "Team can view daylog comments"
ON public.daylog_comments
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  public.has_role(auth.uid(), 'team_member'::app_role)
);

-- Admins and team_members can create comments
CREATE POLICY "Team can create daylog comments"
ON public.daylog_comments
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  public.has_role(auth.uid(), 'team_member'::app_role)
);

-- Only comment author can update their comment
CREATE POLICY "Author can update their comment"
ON public.daylog_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Only comment author or admins can delete comments
CREATE POLICY "Author or admin can delete comment"
ON public.daylog_comments
FOR DELETE
USING (
  auth.uid() = user_id OR
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_daylog_comments_updated_at
BEFORE UPDATE ON public.daylog_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();