-- Add DELETE policy for ticket_attachments
CREATE POLICY "Admins e team members podem deletar anexos" 
ON public.ticket_attachments 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM tickets
    WHERE tickets.id = ticket_attachments.ticket_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      (has_role(auth.uid(), 'team_member'::app_role) AND team_has_access(auth.uid(), tickets.company_id))
    )
  )
);

-- Storage policies for attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Admins and team members can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments');