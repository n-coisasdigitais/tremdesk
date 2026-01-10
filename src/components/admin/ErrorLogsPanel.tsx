import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  FileWarning,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ErrorLog {
  id: string;
  type: string;
  message: string;
  details: Record<string, any> | string | number | boolean | null;
  source: string | null;
  user_id: string | null;
  ticket_id: string | null;
  company_id: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  'google_drive_upload_failed': 'Falha Upload Google Drive',
  'file_upload_failed': 'Falha Upload Arquivo',
  'api_error': 'Erro de API',
  'database_error': 'Erro de Banco de Dados',
};

export const ErrorLogsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [typeFilter, showResolved, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('error_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (!showResolved) {
        query = query.eq('resolved', false);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching error logs:', error);
      toast({
        title: 'Erro ao carregar logs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', logId);

      if (error) throw error;

      toast({ title: 'Log marcado como resolvido' });
      fetchLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao marcar como resolvido',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('Tem certeza que deseja excluir este log?')) return;

    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      toast({ title: 'Log excluído' });
      fetchLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir log',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja excluir TODOS os logs resolvidos? Esta ação não pode ser desfeita.')) return;

    try {
      const { error } = await supabase
        .from('error_logs')
        .delete()
        .eq('resolved', true);

      if (error) throw error;

      toast({ title: 'Logs resolvidos excluídos' });
      fetchLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir logs',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getErrorTypeLabel = (type: string) => {
    return ERROR_TYPE_LABELS[type] || type;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Logs de Erros
            </CardTitle>
            <CardDescription>
              Visualize e gerencie erros do sistema
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDeleteAll}
              disabled={!showResolved}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Resolvidos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="google_drive_upload_failed">Falha Upload Drive</SelectItem>
              <SelectItem value="file_upload_failed">Falha Upload Arquivo</SelectItem>
              <SelectItem value="api_error">Erro de API</SelectItem>
              <SelectItem value="database_error">Erro de Banco</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Mostrar resolvidos
          </label>

          <span className="text-sm text-muted-foreground ml-auto">
            {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>Nenhum erro encontrado!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-4 border rounded-lg ${log.resolved ? 'bg-muted/50' : 'bg-card'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`h-4 w-4 ${log.resolved ? 'text-muted-foreground' : 'text-destructive'}`} />
                      <Badge variant={log.resolved ? 'secondary' : 'destructive'}>
                        {getErrorTypeLabel(log.type)}
                      </Badge>
                      {log.resolved && (
                        <Badge variant="outline" className="text-green-600">
                          Resolvido
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{log.message}</p>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver detalhes
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      {log.source && ` • ${log.source}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!log.resolved && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResolve(log.id)}
                        title="Marcar como resolvido"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(log.id)}
                      title="Excluir log"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
