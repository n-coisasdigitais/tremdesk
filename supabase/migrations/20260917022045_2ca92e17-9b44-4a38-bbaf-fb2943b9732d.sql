ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS approval_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS auto_approved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ticket_approval_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  decision text NOT NULL,
  feedback text,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_approval_codes_ticket ON public.ticket_approval_codes(ticket_id);

GRANT ALL ON public.ticket_approval_codes TO service_role;
GRANT SELECT ON public.ticket_approval_codes TO authenticated;

ALTER TABLE public.ticket_approval_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view approval codes"
ON public.ticket_approval_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

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
  completed_at timestamp with time zone,
  approval_deadline timestamp with time zone,
  auto_approved_at timestamp with time zone,
  approval_status text,
  approval_feedback text,
  approval_decided_at timestamp with time zone
)
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
    c.logo_url AS company_logo_url,
    t.created_at,
    t.updated_at,
    t.due_date,
    t.completed_at,
    t.approval_deadline,
    t.auto_approved_at,
    a.status AS approval_status,
    (a.feedback_json->>'feedback') AS approval_feedback,
    a.created_at AS approval_decided_at
  FROM public.tickets t
  LEFT JOIN public.companies c ON c.id = t.company_id
  LEFT JOIN LATERAL (
    SELECT ap.status, ap.feedback_json, ap.created_at
    FROM public.approvals ap
    WHERE ap.ticket_id = t.id
    ORDER BY ap.created_at DESC
    LIMIT 1
  ) a ON true
  WHERE t.token_acompanhamento = p_token;
$function$;

CREATE OR REPLACE FUNCTION public.auto_conclude_expired_approvals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.tickets
    WHERE status = 'aguardando_aprovacao'
      AND approval_deadline IS NOT NULL
      AND approval_deadline < now()
  LOOP
    UPDATE public.tickets
    SET status = 'concluido',
        completed_at = now(),
        auto_approved_at = now()
    WHERE id = r.id;

    INSERT INTO public.ticket_comments (ticket_id, user_id, content_json)
    VALUES (
      r.id,
      NULL,
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(jsonb_build_object(
              'type', 'text',
              'text', 'Aprovacao automatica por decurso de prazo. A demanda foi concluida.'
            ))
          )
        )
      )
    );

    INSERT INTO public.ticket_activities (ticket_id, user_id, action_type, metadata_json)
    VALUES (r.id, NULL, 'auto_approved', jsonb_build_object('reason', 'deadline_expired'));

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-conclude-expired-approvals',
  '0 * * * *',
  $$SELECT public.auto_conclude_expired_approvals();$$
);