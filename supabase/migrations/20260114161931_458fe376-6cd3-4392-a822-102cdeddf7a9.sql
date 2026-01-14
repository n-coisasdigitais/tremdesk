-- Add JSON columns for rich text content in day_logs
ALTER TABLE public.day_logs 
ADD COLUMN IF NOT EXISTS work_done_json jsonb,
ADD COLUMN IF NOT EXISTS work_pending_json jsonb,
ADD COLUMN IF NOT EXISTS next_steps_json jsonb;

-- Create saved_contacts table for storing email recipients
CREATE TABLE public.saved_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.saved_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_contacts
-- Admins and super_admins can see all contacts
CREATE POLICY "Admins can view all contacts"
ON public.saved_contacts
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Users can view their own contacts
CREATE POLICY "Users can view own contacts"
ON public.saved_contacts
FOR SELECT
USING (created_by = auth.uid());

-- Users can insert their own contacts
CREATE POLICY "Users can insert own contacts"
ON public.saved_contacts
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
ON public.saved_contacts
FOR UPDATE
USING (created_by = auth.uid());

-- Users can delete their own contacts
CREATE POLICY "Users can delete own contacts"
ON public.saved_contacts
FOR DELETE
USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_saved_contacts_updated_at
BEFORE UPDATE ON public.saved_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_saved_contacts_created_by ON public.saved_contacts(created_by);
CREATE INDEX idx_saved_contacts_email ON public.saved_contacts(email);