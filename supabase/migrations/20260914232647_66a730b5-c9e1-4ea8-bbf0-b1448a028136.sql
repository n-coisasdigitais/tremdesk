DROP FUNCTION IF EXISTS public.get_ticket_by_token(uuid);

CREATE FUNCTION public.get_ticket_by_token(p_token uuid)
 RETURNS TABLE(protocolo text, title text, status text, category text, company_name text, created_at timestamp with time zone, updated_at timestamp with time zone, due_date date, completed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    t.protocolo,
    t.title,
    t.status::text,
    t.category::text,
    c.name AS company_name,
    t.created_at,
    t.updated_at,
    t.due_date,
    t.completed_at
  FROM public.tickets t
  LEFT JOIN public.companies c ON c.id = t.company_id
  WHERE t.token_acompanhamento = p_token;
$function$;