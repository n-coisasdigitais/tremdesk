import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  HardDrive, 
  RefreshCw, 
  Loader2, 
  Upload, 
  CheckCircle,
  XCircle,
  FileImage,
  FileText,
  FileArchive,
  File,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingAttachment {
  id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
  ticket_id: string;
  created_at: string;
  ticket?: {
    title: string;
    company_id: string;
    company?: {
      name: string;
    };
  };
}

interface MigrationResult {
  id: string;
  success: boolean;
  error?: string;
}

export const MigrateToGoogleDrivePanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleDriveConfigured, setGoogleDriveConfigured] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migratingId, setMigratingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<MigrationResult[]>([]);

  useEffect(() => {
    checkConfig();
    fetchPendingAttachments();
  }, []);

  const checkConfig = async () => {
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
      
      setGoogleDriveConfigured(isConfigured);
    } catch (err) {
      console.error('Erro ao verificar config:', err);
      setGoogleDriveConfigured(false);
    }
  };

  const fetchPendingAttachments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select(`
          id,
          file_name,
          file_type,
          file_url,
          ticket_id,
          created_at,
          ticket:tickets(title, company_id, company:companies(name))
        `)
        .is('google_drive_file_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      console.error('Error fetching pending attachments:', error);
      toast({
        title: 'Erro ao carregar arquivos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const migrateFile = async (attachment: PendingAttachment): Promise<boolean> => {
    try {
      console.log('📤 Iniciando migração:', {
        file_name: attachment.file_name,
        ticket_id: attachment.ticket_id,
        company_id: attachment.ticket?.company_id,
      });
      
      // Download file from Supabase Storage
      console.log('📥 Baixando arquivo do Supabase Storage...');
      const base64 = await downloadFile(attachment.file_url);
      console.log('✅ Download concluído. Tamanho base64:', base64.length);
      
      // Upload to Google Drive
      console.log('📤 Enviando para Google Drive...');
      const { data, error } = await supabase.functions.invoke('google-drive-folders', {
        body: {
          action: 'upload_file',
          demand_id: attachment.ticket_id,
          company_id: attachment.ticket?.company_id,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_content: base64,
        },
      });

      console.log('📬 Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw new Error(error.message);
      }
      
      if (data?.error) {
        console.error('❌ Erro retornado pela API:', data.error);
        throw new Error(data.error);
      }
      
      // Check for file_id in response (API returns file_id, not file_url as primary indicator)
      const fileId = data?.file_id;
      const fileUrl = data?.file_url;
      const folderId = data?.folder_id;
      
      console.log('📋 Dados extraídos:', { fileId, fileUrl, folderId });
      
      if (!fileId) {
        console.error('❌ Resposta incompleta - sem file_id:', data);
        throw new Error('Resposta incompleta: file_id não encontrado');
      }

      // Update attachment record
      console.log('💾 Atualizando registro no banco de dados...');
      const { error: updateError } = await supabase
        .from('ticket_attachments')
        .update({
          file_url: fileUrl,
          google_drive_file_id: fileId,
          google_drive_folder_id: folderId,
        })
        .eq('id', attachment.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar banco:', updateError);
        throw updateError;
      }

      // Log success
      console.log('✅ Arquivo migrado com sucesso:', {
        file_name: attachment.file_name,
        file_id: fileId,
        folder_id: folderId,
      });

      // Delete from Supabase Storage after successful migration
      if (attachment.file_url.includes('supabase')) {
        const path = attachment.file_url.split('/attachments/')[1];
        if (path) {
          console.log('🗑️ Removendo arquivo do Supabase Storage:', path);
          const { error: deleteError } = await supabase.storage.from('attachments').remove([path]);
          if (deleteError) {
            console.warn('⚠️ Falha ao remover do Storage (não crítico):', deleteError);
          } else {
            console.log('✅ Arquivo removido do Supabase Storage');
          }
        }
      }

      return true;
    } catch (err: any) {
      console.error('❌ Falha na migração:', err);
      
      // Log error to database
      try {
        await supabase.from('error_logs').insert({
          type: 'google_drive_migration_failed',
          message: err.message || 'Erro desconhecido',
          details: {
            attachment_id: attachment.id,
            file_name: attachment.file_name,
            ticket_id: attachment.ticket_id,
            error_stack: err.stack,
          },
          source: 'MigrateToGoogleDrivePanel',
          user_id: user?.id,
          ticket_id: attachment.ticket_id,
        });
      } catch (logErr) {
        console.error('❌ Erro ao salvar log:', logErr);
      }

      return false;
    }
  };

  const handleMigrateOne = async (attachment: PendingAttachment) => {
    setMigratingId(attachment.id);
    try {
      const success = await migrateFile(attachment);
      
      if (success) {
        toast({ title: 'Arquivo migrado com sucesso!' });
        fetchPendingAttachments();
      } else {
        toast({
          title: 'Falha na migração',
          description: 'Verifique os logs de erros para mais detalhes.',
          variant: 'destructive',
        });
      }
    } finally {
      setMigratingId(null);
    }
  };

  const handleMigrateAll = async () => {
    if (!confirm(`Tem certeza que deseja migrar ${attachments.length} arquivos para o Google Drive?`)) return;

    setMigrating(true);
    setProgress(0);
    setResults([]);

    const migrationResults: MigrationResult[] = [];

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      const success = await migrateFile(attachment);
      
      migrationResults.push({
        id: attachment.id,
        success,
        error: success ? undefined : 'Falha na migração',
      });

      setProgress(((i + 1) / attachments.length) * 100);
      setResults([...migrationResults]);
    }

    const successCount = migrationResults.filter(r => r.success).length;
    const failCount = migrationResults.filter(r => !r.success).length;

    toast({
      title: 'Migração concluída',
      description: `${successCount} arquivos migrados, ${failCount} falhas.`,
    });

    setMigrating(false);
    fetchPendingAttachments();
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Migrar para Google Drive
            </CardTitle>
            <CardDescription>
              Migre arquivos do armazenamento local para o Google Drive
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPendingAttachments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!googleDriveConfigured && (
          <div className="flex items-center gap-3 p-4 mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Google Drive não configurado</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Configure o Google Drive na aba Integrações antes de migrar os arquivos.
              </p>
            </div>
          </div>
        )}

        {migrating && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Migrando arquivos...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            <div className="flex gap-2 text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {results.filter(r => r.success).length} sucesso
              </span>
              <span className="text-destructive flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                {results.filter(r => !r.success).length} falhas
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>Todos os arquivos já estão no Google Drive!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                <Badge variant="secondary">{attachments.length}</Badge> arquivos pendentes de migração
              </p>
              <Button
                onClick={handleMigrateAll}
                disabled={!googleDriveConfigured || migrating}
              >
                {migrating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Migrar Todos
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  {getFileIcon(attachment.file_type, attachment.file_name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.ticket?.company?.name || 'Empresa'} • {' '}
                      {attachment.ticket?.title || 'Ticket'} • {' '}
                      {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMigrateOne(attachment)}
                    disabled={!googleDriveConfigured || migrating || migratingId === attachment.id}
                  >
                    {migratingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
