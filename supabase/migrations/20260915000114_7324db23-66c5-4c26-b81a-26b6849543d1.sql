ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS solicitante_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_solicitante_email ON public.tickets (lower(solicitante_email));
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante_user_id ON public.tickets (solicitante_user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Vincula demandas já abertas por esta pessoa (solicitante) ao novo usuário
  IF NEW.email IS NOT NULL THEN
    UPDATE public.tickets
    SET solicitante_user_id = NEW.id
    WHERE solicitante_user_id IS NULL
      AND lower(solicitante_email) = lower(NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;