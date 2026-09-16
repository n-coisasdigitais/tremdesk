DROP FUNCTION IF EXISTS public.get_ticket_by_token(uuid);

CREATE FUNCTION public.get_ticket_by_token(p_token uuid)
RETURNS TABLE(
  protocolo text,
  title text,
  status text,
  category text,
  company_name text,
  company_logo_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  due_date date,
  completed_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    t.protocolo,
    t.title,
    t.status::text,
    t.category::text,
    c.name AS company_name,
    c.logo_url AS company_logo_url,
    t.created_at,
    t.updated_at,
    t.due_date,
    t.completed_at
  FROM public.tickets t
  LEFT JOIN public.companies c ON c.id = t.company_id
  WHERE t.token_acompanhamento = p_token;
$function$;

REVOKE ALL ON FUNCTION public.get_ticket_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_ticket_attachments_by_token(p_token uuid)
RETURNS TABLE(
  id uuid,
  file_name text,
  file_type text,
  created_at timestamp with time zone,
  is_external boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ta.id,
    ta.file_name,
    ta.file_type,
    ta.created_at,
    (ta.file_url ~* '^https?://') AS is_external
  FROM public.ticket_attachments ta
  JOIN public.tickets t ON t.id = ta.ticket_id
  WHERE t.token_acompanhamento = p_token
  ORDER BY ta.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_ticket_attachments_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_attachments_by_token(uuid) TO anon, authenticated, service_role;