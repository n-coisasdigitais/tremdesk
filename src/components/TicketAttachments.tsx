import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Upload, File, Trash2, ExternalLink, Loader2, FolderOpen, FileImage, FileText, FileArchive } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketAttachment {
  id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
  google_drive_file_id: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader?: {
    full_name: string;
  };
}

interface TicketAttachmentsProps {
  ticketId: string;
  companyId: string;
}

export const TicketAttachments = ({ ticketId, companyId }: TicketAttachmentsProps) => {
  const { user, isAdmin, isTeamMember } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [googleDriveConfigured, setGoogleDriveConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetchAttachments();
    checkGoogleDriveConfig();
  }, [ticketId]);

  const checkGoogleDriveConfig = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'google_service_account_email',
          'google_service_account_key', 
          'google_drive_root_folder_id'
        ]);
      
      const settings = Object.fromEntries(
        data?.map(s => [s.key, s.value]) || []
      );
      
      const isConfigured = !!(
        settings.google_service_account_email && 
        settings.google_service_account_key && 
        settings.google_drive_root_folder_id
      );
      
      console.log('Google Drive configuração:', {
        hasEmail: !!settings.google_service_account_email,
        hasKey: !!settings.google_service_account_key,
        hasRootFolder: !!settings.google_drive_root_folder_id,
        isConfigured
      });
      
      setGoogleDriveConfigured(isConfigured);
    } catch (err) {
      console.error('Erro ao verificar config do Google Drive:', err);
      setGoogleDriveConfigured(false);
    }
  };

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('*, uploader:profiles!ticket_attachments_uploaded_by_fkey(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);

      // Get folder URL from first attachment if exists
      if (data && data.length > 0 && data[0].google_drive_folder_id) {
        setFolderUrl(`https://drive.google.com/drive/folders/${data[0].google_drive_folder_id}`);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
      toast({ title: 'Arquivos enviados com sucesso!' });
      await fetchAttachments();
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar arquivo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadFile = async (file: File) => {
    // Try Google Drive first if configured
    if (googleDriveConfigured) {
      try {
        console.log('📤 Iniciando upload para Google Drive...', { fileName: file.name, ticketId, companyId });
        const base64 = await fileToBase64(file);
        
        const { data, error } = await supabase.functions.invoke('google-drive-folders', {
          body: {
            action: 'upload_file',
            demand_id: ticketId,
            company_id: companyId,
            file_name: file.name,
            file_type: file.type,
            file_content: base64,
          },
        });

        console.log('📥 Resposta do Google Drive:', { data, error });

        if (error) {
          console.error('❌ Erro na edge function:', error);
          throw new Error(error.message || 'Erro ao chamar edge function');
        }

        if (data?.error) {
          console.error('❌ Erro retornado pela API do Google Drive:', data.error);
          throw new Error(data.error);
        }

        if (!data?.file_url || !data?.file_id) {
          console.error('❌ Resposta incompleta do Google Drive:', data);
          throw new Error('Resposta incompleta do Google Drive');
        }

        // Save attachment record with Google Drive info
        const { error: insertError } = await supabase.from('ticket_attachments').insert({
          ticket_id: ticketId,
          file_name: file.name,
          file_type: file.type,
          file_url: data.file_url,
          google_drive_file_id: data.file_id,
          google_drive_folder_id: data.folder_id,
          uploaded_by: user?.id,
        });

        if (insertError) throw insertError;

        if (data.folder_url) {
          setFolderUrl(data.folder_url);
        }
        
        console.log('✅ Upload para Google Drive concluído com sucesso!');
        return; // Success with Google Drive
      } catch (err: any) {
        console.error('❌ Google Drive upload falhou:', err);
        
        // Log error to database
        try {
          await supabase.from('error_logs').insert({
            type: 'google_drive_upload_failed',
            message: err.message,
            details: {
              file_name: file.name,
              file_type: file.type,
              ticket_id: ticketId,
              company_id: companyId,
            },
            source: 'TicketAttachments',
            user_id: user?.id,
            ticket_id: ticketId,
            company_id: companyId,
          });
        } catch (logError) {
          console.error('Erro ao salvar log:', logError);
        }
        
        toast({
          title: 'Aviso: Fallback para armazenamento local',
          description: `Upload para Google Drive falhou: ${err.message}. Arquivo será salvo localmente.`,
        });
      }
    } else {
      console.log('ℹ️ Google Drive não configurado, usando armazenamento local');
    }

    // Fallback to Supabase Storage
    await uploadToSupabaseStorage(file);
  };

  const uploadToSupabaseStorage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Store the file path (not public URL) for later signed URL generation
    // Format: attachments/{ticketId}/{timestamp}-{random}.{ext}
    const storagePath = fileName;

    // Save attachment record with the storage path
    const { error: insertError } = await supabase.from('ticket_attachments').insert({
      ticket_id: ticketId,
      file_name: file.name,
      file_type: file.type,
      file_url: storagePath, // Store path, not public URL
      uploaded_by: user?.id,
    });

    if (insertError) throw insertError;
  };

  // Generate signed URL for secure file access
  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    // If it's a Google Drive URL, return as-is
    if (filePath.startsWith('http')) {
      return filePath;
    }
    
    // Generate signed URL with 1 hour expiration
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  };

  const handleOpenFile = async (attachment: TicketAttachment) => {
    const url = await getSignedUrl(attachment.file_url);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: 'Erro ao abrir arquivo',
        description: 'Não foi possível gerar URL de acesso.',
        variant: 'destructive',
      });
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDelete = async (attachment: TicketAttachment) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;

    try {
      // If it's a Supabase Storage file, delete from storage too
      if (!attachment.google_drive_file_id) {
        // Check if it's a full URL (legacy) or just a path (new format)
        let storagePath = attachment.file_url;
        if (attachment.file_url.includes('supabase')) {
          // Legacy: extract path from full URL
          storagePath = attachment.file_url.split('/attachments/')[1] || '';
        }
        
        if (storagePath) {
          await supabase.storage.from('attachments').remove([storagePath]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('ticket_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      toast({ title: 'Arquivo removido!' });
      await fetchAttachments();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover arquivo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (fileType: string | null, fileName: string) => {
    if (fileType?.startsWith('image/')) {
      return <FileImage className="h-4 w-4 text-green-600" />;
    }
    if (fileType?.includes('pdf') || fileName.endsWith('.pdf')) {
      return <FileText className="h-4 w-4 text-red-600" />;
    }
    if (fileType?.includes('zip') || fileType?.includes('rar') || fileName.match(/\.(zip|rar|7z)$/i)) {
      return <FileArchive className="h-4 w-4 text-yellow-600" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const canDelete = isAdmin || isTeamMember;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Arquivos ({attachments.length})
        </h4>
        <div className="flex gap-2">
          {folderUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(folderUrl, '_blank')}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Abrir Pasta
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Enviar Arquivo
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          <p>Nenhum arquivo anexado.</p>
          <p className="text-xs mt-1">Clique em "Enviar Arquivo" para adicionar documentos, imagens ou outros arquivos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 border rounded-md bg-card hover:bg-accent/50 transition-colors"
            >
              {getFileIcon(attachment.file_type, attachment.file_name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.uploader?.full_name || 'Usuário'} • {' '}
                  {format(new Date(attachment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {attachment.google_drive_file_id && ' • Google Drive'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenFile(attachment)}
                  title="Abrir arquivo"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(attachment)}
                    title="Remover arquivo"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};