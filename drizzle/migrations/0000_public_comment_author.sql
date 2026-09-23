ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_email text;

CREATE OR REPLACE FUNCTION public.add_public_ticket_comment(
  p_token uuid,
  p_content text,
  p_author_name text,
  p_author_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_id uuid;
  v_comment_id uuid;
  v_name text;
BEGIN
  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RAISE EXCEPTION 'Comentario vazio';
  END IF;

  IF length(p_content) > 5000 THEN
    RAISE EXCEPTION 'Comentario muito longo';
  END IF;

  SELECT id INTO v_ticket_id
  FROM public.tickets
  WHERE token_acompanhamento = p_token;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Demanda nao encontrada';
  END IF;

  v_name := NULLIF(btrim(COALESCE(p_author_name, '')), '');
  IF v_name IS NOT NULL AND length(v_name) > 120 THEN
    v_name := left(v_name, 120);
  END IF;

  INSERT INTO public.ticket_comments (ticket_id, user_id, content_json, author_name, author_email)
  VALUES (
    v_ticket_id,
    NULL,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_content))
        )
      )
    ),
    v_name,
    NULLIF(btrim(COALESCE(p_author_email, '')), '')
  )
  RETURNING id INTO v_comment_id;

  UPDATE public.tickets SET updated_at = now() WHERE id = v_ticket_id;

  RETURN v_comment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_public_ticket_comment(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_public_ticket_comment(uuid, text, text, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.add_ticket_comment_by_token(uuid, text) IS 'DEPRECATED: substituida por add_public_ticket_comment(uuid, text, text, text), que registra o autor.';

DROP FUNCTION IF EXISTS public.get_ticket_history_by_token(uuid);

CREATE FUNCTION public.get_ticket_history_by_token(p_token uuid)
RETURNS TABLE(id uuid, author_name text, is_client boolean, content_json jsonb, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    tc.id,
    COALESCE(p.full_name, tc.author_name, t.solicitante_nome, 'Solicitante') AS author_name,
    (tc.user_id IS NULL) AS is_client,
    tc.content_json,
    tc.created_at
  FROM public.ticket_comments tc
  JOIN public.tickets t ON t.id = tc.ticket_id
  LEFT JOIN public.profiles p ON p.id = tc.user_id
  WHERE t.token_acompanhamento = p_token
  ORDER BY tc.created_at ASC;
$function$;

REVOKE ALL ON FUNCTION public.get_ticket_history_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_history_by_token(uuid) TO anon, authenticated, service_role;