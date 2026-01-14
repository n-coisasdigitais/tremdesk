-- Step 2: Create admin_company_exclusions table
CREATE TABLE public.admin_company_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.admin_company_exclusions ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage exclusions
CREATE POLICY "Super admins podem gerenciar exclusoes"
ON public.admin_company_exclusions
FOR ALL USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Create admin_can_access_company function
CREATE OR REPLACE FUNCTION public.admin_can_access_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admins always have full access
    public.has_role(_user_id, 'super_admin'::app_role)
    OR
    -- Regular admins, check if not excluded
    NOT EXISTS (
      SELECT 1
      FROM public.admin_company_exclusions
      WHERE user_id = _user_id
        AND company_id = _company_id
    )
$$;

-- Update has_role function to include super_admin check for admin permissions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (role = 'super_admin'::app_role AND _role = 'admin'::app_role)
      )
  )
$$;