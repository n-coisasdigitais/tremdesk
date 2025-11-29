-- Add 'arquivado' to ticket_status enum
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'arquivado';

-- Allow admins and team members to delete tickets that are in 'novo' status
CREATE POLICY "Admins e team members podem deletar tickets novos"
ON public.tickets
FOR DELETE
USING (
  status = 'novo' AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), company_id))
  )
);