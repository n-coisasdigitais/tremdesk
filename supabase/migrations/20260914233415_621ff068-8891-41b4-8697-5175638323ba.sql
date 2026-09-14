CREATE OR REPLACE FUNCTION public.get_ticket_history_by_token(p_token uuid)
RETURNS TABLE(id uuid, author_name text, is_client boolean, content_json jsonb, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tc.id,
    COALESCE(p.full_name, t.solicitante_nome, 'Solicitante') AS author_name,
    (tc.user_id IS NULL) AS is_client,
    tc.content_json,
    tc.created_at
  FROM public.ticket_comments tc
  JOIN public.tickets t ON t.id = tc.ticket_id
  LEFT JOIN public.profiles p ON p.id = tc.user_id
  WHERE t.token_acompanhamento = p_token
  ORDER BY tc.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.add_ticket_comment_by_token(p_token uuid, p_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_comment_id uuid;
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

  INSERT INTO public.ticket_comments (ticket_id, user_id, content_json)
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
    )
  )
  RETURNING id INTO v_comment_id;

  UPDATE public.tickets SET updated_at = now() WHERE id = v_ticket_id;

  RETURN v_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ticket_history_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_ticket_comment_by_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_history_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ticket_comment_by_token(uuid, text) TO anon, authenticated;