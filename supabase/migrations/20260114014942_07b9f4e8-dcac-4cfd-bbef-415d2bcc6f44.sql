-- Make attachments bucket private (no longer publicly accessible)
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- Drop existing permissive storage policies for attachments
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;

-- Create secure policy for uploading attachments (authenticated users can upload)
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Create secure policy for viewing attachments with ticket access validation
-- Uses EXISTS subquery to validate the user has access to the ticket
CREATE POLICY "Users can view attachments for accessible tickets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (
    -- Admins can view all attachments
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    -- Team members can view if they have access to the ticket's company
    EXISTS (
      SELECT 1 FROM ticket_attachments ta
      JOIN tickets t ON t.id = ta.ticket_id
      WHERE ta.file_url LIKE '%' || storage.objects.name
      AND has_role(auth.uid(), 'team_member'::app_role)
      AND team_has_access(auth.uid(), t.company_id)
    ) OR
    -- Company users can view their company's ticket attachments
    EXISTS (
      SELECT 1 FROM ticket_attachments ta
      JOIN tickets t ON t.id = ta.ticket_id
      WHERE ta.file_url LIKE '%' || storage.objects.name
      AND is_company_user(auth.uid(), t.company_id)
    )
  )
);

-- Create secure policy for deleting attachments with ticket access validation
CREATE POLICY "Users can delete attachments for accessible tickets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (
    -- Admins can delete all attachments
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    -- Team members can delete if they have access to the ticket's company
    EXISTS (
      SELECT 1 FROM ticket_attachments ta
      JOIN tickets t ON t.id = ta.ticket_id
      WHERE ta.file_url LIKE '%' || storage.objects.name
      AND has_role(auth.uid(), 'team_member'::app_role)
      AND team_has_access(auth.uid(), t.company_id)
    )
  )
);