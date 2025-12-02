-- Add site_url setting for password recovery emails
INSERT INTO public.system_settings (key, value, description, is_secret)
VALUES ('site_url', 'https://f1808f3b-a2f2-422f-ac3d-79ee4012689c.lovableproject.com', 'URL do site para links de email (ex: redefinição de senha)', false)
ON CONFLICT (key) DO NOTHING;