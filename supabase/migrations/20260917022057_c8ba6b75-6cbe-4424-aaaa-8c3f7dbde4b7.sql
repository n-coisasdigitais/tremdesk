REVOKE ALL ON FUNCTION public.auto_conclude_expired_approvals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_conclude_expired_approvals() FROM anon;
REVOKE ALL ON FUNCTION public.auto_conclude_expired_approvals() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auto_conclude_expired_approvals() TO service_role;