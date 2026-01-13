-- Criar política de UPDATE para ticket_attachments
-- Necessária para permitir a migração de arquivos para o Google Drive

CREATE POLICY "Admins e team members podem atualizar anexos"
ON public.ticket_attachments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
    )
  )
);