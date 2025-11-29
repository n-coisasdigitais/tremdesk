import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTickets } from '@/hooks/useTickets';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Archive, Eye, EyeOff } from 'lucide-react';
import { Ticket, TicketStatus } from '@/types';
import { NewTicketModal } from '@/components/NewTicketModal';
import { TicketDetailModal } from '@/components/TicketDetailModal';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string }> = {
  novo: { label: 'Novo', color: 'bg-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  em_andamento: { label: 'Em Andamento', color: 'bg-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950' },
  aguardando_aprovacao: { label: 'Aguardando', color: 'bg-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500', bgColor: 'bg-green-50 dark:bg-green-950' },
  concluido: { label: 'Concluído', color: 'bg-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', bgColor: 'bg-red-50 dark:bg-red-950' },
  arquivado: { label: 'Arquivado', color: 'bg-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-950' },
};

const priorityConfig = {
  baixa: { label: 'Baixa', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

const categoryIcons: Record<string, string> = {
  meta_ads: '📱',
  google_ads: '🔍',
  linkedin_ads: '💼',
  arte: '🎨',
  relatorio: '📊',
  outro: '⚙️',
};

interface DraggableTicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

const DraggableTicketCard = ({ ticket, onClick }: DraggableTicketCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} onClick={onClick} />
    </div>
  );
};

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

const TicketCard = ({ ticket, onClick }: TicketCardProps) => {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] bg-card"
      onClick={onClick}
    >
      <CardHeader className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg">{categoryIcons[ticket.category] || '📋'}</span>
          <Badge className={priorityConfig[ticket.priority].color} variant="secondary">
            {priorityConfig[ticket.priority].label}
          </Badge>
        </div>

        <h4 className="font-medium line-clamp-2 text-sm">{ticket.title}</h4>

        {ticket.company && (
          <p className="text-xs text-muted-foreground">{ticket.company.name}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ticket.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(ticket.due_date), 'dd/MM', { locale: ptBR })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {ticket.assignee && (
              <Avatar className="h-6 w-6">
                <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {ticket.assignee.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

interface KanbanColumnProps {
  status: TicketStatus;
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

const KanbanColumn = ({ status, tickets, onTicketClick }: KanbanColumnProps) => {
  const config = statusConfig[status];
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div className={`flex items-center justify-between p-3 rounded-t-lg ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${config.color}`} />
          <h3 className="font-semibold text-sm">{config.label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {tickets.length}
        </Badge>
      </div>

      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div 
          ref={setNodeRef}
          className={`flex-1 p-2 space-y-3 min-h-[400px] rounded-b-lg border-x border-b transition-colors ${config.bgColor} ${isOver ? 'ring-2 ring-primary ring-inset' : ''}`}
        >
          {tickets.map((ticket) => (
            <DraggableTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
            />
          ))}
          {tickets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma demanda
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default function Kanban() {
  const { tickets, loading, updateTicketStatus, fetchTickets } = useTickets();
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const columns: TicketStatus[] = showArchived 
    ? ['arquivado'] 
    : ['novo', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'concluido'];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets.filter((t) => t.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const ticketId = active.id as string;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    let newStatus: TicketStatus | null = null;

    // Check if dropped on a column (status)
    const columnStatus = columns.find((col) => col === over.id);
    if (columnStatus) {
      newStatus = columnStatus;
    } else {
      // Dropped on another ticket - get that ticket's status
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) {
        newStatus = overTicket.status;
      }
    }

    if (newStatus && newStatus !== ticket.status) {
      await updateTicketStatus(ticketId, newStatus);
    }
  };

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {showArchived ? 'Demandas Arquivadas' : 'Kanban de Demandas'}
            </h1>
            <p className="text-muted-foreground">
              {showArchived ? 'Visualize as demandas arquivadas' : 'Arraste os cards para mudar o status'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showArchived ? "default" : "outline"} 
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Voltar ao Kanban
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Ver Arquivados
                </>
              )}
            </Button>
            {!showArchived && (
              <Button onClick={() => setNewTicketOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Demanda
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tickets={getTicketsByStatus(status)}
                  onTicketClick={setSelectedTicket}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTicket && (
                <div className="rotate-3 scale-105">
                  <TicketCard ticket={activeTicket} onClick={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <NewTicketModal open={newTicketOpen} onOpenChange={setNewTicketOpen} />
      
      <TicketDetailModal
        ticket={selectedTicket}
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
        onUpdate={fetchTickets}
      />
    </Layout>
  );
}
