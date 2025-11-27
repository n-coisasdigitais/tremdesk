import { Layout } from '@/components/Layout';
import { useTickets } from '@/hooks/useTickets';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TicketStatus } from '@/types';

const statusConfig = {
  novo: { label: 'Novo', color: 'bg-blue-100 text-blue-800' },
  em_andamento: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' },
  aguardando_aprovacao: { label: 'Aguardando', color: 'bg-orange-100 text-orange-800' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  concluido: { label: 'Concluído', color: 'bg-gray-100 text-gray-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
};

export default function Kanban() {
  const { tickets, loading } = useTickets();

  const columns: TicketStatus[] = ['novo', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'concluido'];

  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets.filter(t => t.status === status);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Kanban de Demandas</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Demanda
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {columns.map(status => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{statusConfig[status].label}</h3>
                <Badge variant="secondary">{getTicketsByStatus(status).length}</Badge>
              </div>
              
              <div className="space-y-3 min-h-[200px]">
                {getTicketsByStatus(status).map(ticket => (
                  <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4">
                      <h4 className="font-medium line-clamp-2">{ticket.title}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={statusConfig[ticket.priority].color}>
                          {ticket.priority}
                        </Badge>
                        {ticket.assignee && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={ticket.assignee.avatar_url} />
                            <AvatarFallback>{ticket.assignee.full_name[0]}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
