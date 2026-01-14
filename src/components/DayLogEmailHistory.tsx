import { useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, Clock, User, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useDayLogEmailHistory } from '@/hooks/useDayLogEmailHistory';

interface DayLogEmailHistoryProps {
  dayLogId: string;
}

export function DayLogEmailHistory({ dayLogId }: DayLogEmailHistoryProps) {
  const { emailHistory, loading, fetchEmailHistory } = useDayLogEmailHistory(dayLogId);

  useEffect(() => {
    fetchEmailHistory();
  }, [fetchEmailHistory]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Histórico de Envios
          {emailHistory.length > 0 && (
            <Badge variant="secondary">{emailHistory.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {emailHistory.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">
            Este DayLog ainda não foi enviado por email.
          </p>
        ) : (
          <div className="space-y-4">
            {emailHistory.map((send) => (
              <div 
                key={send.id}
                className="p-4 rounded-lg bg-muted/50 border border-border/50"
              >
                {/* Header with sender and date */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {send.sender_profile ? (
                      <>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={send.sender_profile.avatar_url || ''} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(send.sender_profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {send.sender_profile.full_name}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Usuário</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(send.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>

                {/* Recipients */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Para:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {send.sent_to.map((email, index) => (
                      <Badge 
                        key={`${send.id}-${index}`} 
                        variant="outline" 
                        className="text-xs"
                      >
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
