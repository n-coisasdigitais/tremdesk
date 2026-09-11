import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useTickets } from "@/hooks/useTickets";
import { useTicketLinks } from "@/hooks/useTicketLinks";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Archive, EyeOff, BookOpen, Link2 } from "lucide-react";
import { Ticket, TicketStatus } from "@/types";
import { NewTicketModal } from "@/components/NewTicketModal";
import { TicketDetailModal } from "@/components/TicketDetailModal";
import { KanbanFilters, KanbanFiltersState, filterTickets } from "@/components/KanbanFilters";
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
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// AJUSTE VISUAL — colunas neutras (estilo Notion/Linear): a cor de
// identidade do status fica só na bolinha do cabeçalho (`color`), o fundo
// da coluna deixa de variar por status e vira um cinza neutro (`bgColor`).
// Isso concentra a atenção no conteúdo dos cards em vez do "papel de
// parede" colorido atrás deles. Ver claude/rita-melhoria-visual.md.
const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string }> = {
  novo: { label: "Novo", color: "bg-blue-500", bgColor: "bg-muted/40" },
  em_andamento: { label: "Em Andamento", color: "bg-yellow-500", bgColor: "bg-muted/40" },
  aguardando_aprovacao: { label: "Aguardando", color: "bg-orange-500", bgColor: "bg-muted/40" },
  aprovado: { label: "Aprovado", color: "bg-green-500", bgColor: "bg-muted/40" },
  concluido: { label: "Concluído", color: "bg-gray-500", bgColor: "bg-muted/40" },
  cancelado: { label: "Cancelado", color: "bg-red-500", bgColor: "bg-muted/40" },
  arquivado: { label: "Arquivado", color: "bg-slate-500", bgColor: "bg-muted/40" },
};

const priorityConfig = {
  baixa: { label: "Baixa", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const categoryIcons: Record<string, string> = {
  meta_ads: "📱",
  google_ads: "🔍",
  linkedin_ads: "💼",
  arte: "🎨",
  relatorio: "📊",
  outro: "⚙️",
};

interface GroupedTicketInfo {
  isGrouped: boolean;
  isFirst: boolean;
  isLast: boolean;
  groupSize: number;
}

interface DraggableTicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  groupInfo?: GroupedTicketInfo;
}

const DraggableTicketCard = ({ ticket, onClick, groupInfo }: DraggableTicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} onClick={onClick} groupInfo={groupInfo} />
    </div>
  );
};

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  groupInfo?: GroupedTicketInfo;
}

const TicketCard = ({ ticket, onClick, groupInfo }: TicketCardProps) => {
  const isGrouped = groupInfo?.isGrouped;
  const isFirst = groupInfo?.isFirst;
  const isLast = groupInfo?.isLast;
  const groupSize = groupInfo?.groupSize || 0;

  return (
    <div className={`relative ${isGrouped ? "pl-3" : ""}`}>
      {/* Vertical connection line for grouped tickets */}
      {isGrouped && (
        <div className="absolute left-0 top-0 bottom-0 w-1">
          <div
            className={`absolute left-0 w-1 bg-primary/60 ${
              isFirst
                ? "top-1/2 bottom-0 rounded-t-full"
                : isLast
                  ? "top-0 bottom-1/2 rounded-b-full"
                  : "top-0 bottom-0"
            }`}
          />
          {/* Horizontal connector */}
          <div className="absolute left-1 top-1/2 w-2 h-0.5 bg-primary/60 -translate-y-1/2" />
        </div>
      )}

      {/*
        AJUSTE VISUAL — hover sem "zoom": trocamos hover:scale/shadow (efeito
        de e-commerce) por uma leve mudança de fundo + borda, sem movimento.
        Mais adequado para uma ferramenta de trabalho onde o olho passa horas.
      */}
      <Card
        className={`cursor-pointer border-transparent hover:border-border hover:bg-accent/40 transition-colors bg-card ${
          isGrouped ? "border-l-2 border-l-primary/40" : ""
        }`}
        onClick={onClick}
      >
        <CardHeader className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-lg">{categoryIcons[ticket.category] || "📋"}</span>
              {ticket.daylog_id && (
                <span title="Vinculado a DayLog">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
              {/* Link indicator for grouped or linked tickets */}
              {groupSize > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-xs text-primary">
                        <Link2 className="h-3.5 w-3.5" />
                        {!isGrouped && <span>{groupSize}</span>}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isGrouped
                          ? `Grupo de ${groupInfo?.groupSize} demandas vinculadas`
                          : `${groupSize} demanda(s) vinculada(s) em outras colunas`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Badge className={priorityConfig[ticket.priority].color} variant="secondary">
              {priorityConfig[ticket.priority].label}
            </Badge>
          </div>

          <h4 className="font-medium line-clamp-2 text-sm">{ticket.title}</h4>

          {ticket.company && <p className="text-xs text-muted-foreground">{ticket.company.name}</p>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {ticket.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(ticket.due_date), "dd/MM", { locale: ptBR })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {ticket.assignee && (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{ticket.assignee.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

interface GroupedTicket {
  ticket: Ticket;
  isGrouped: boolean;
  isFirst: boolean;
  isLast: boolean;
  groupSize: number;
}

interface KanbanColumnProps {
  status: TicketStatus;
  groupedTickets: GroupedTicket[];
  onTicketClick: (ticket: Ticket) => void;
}

const KanbanColumn = ({ status, groupedTickets, onTicketClick }: KanbanColumnProps) => {
  const config = statusConfig[status];

  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex flex-col w-[260px] sm:w-[280px] md:min-w-[280px] md:max-w-[320px] flex-shrink-0">
      <div className={`flex items-center justify-between p-3 rounded-t-lg ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${config.color}`} />
          <h3 className="font-semibold text-sm">{config.label}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {groupedTickets.length}
        </Badge>
      </div>

      <SortableContext items={groupedTickets.map((gt) => gt.ticket.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 p-2 space-y-2 min-h-[300px] sm:min-h-[400px] rounded-b-lg border-x border-b transition-colors ${config.bgColor} ${isOver ? "ring-2 ring-primary ring-inset" : ""}`}
        >
          {groupedTickets.map((gt) => (
            <DraggableTicketCard
              key={gt.ticket.id}
              ticket={gt.ticket}
              onClick={() => onTicketClick(gt.ticket)}
              groupInfo={{
                isGrouped: gt.isGrouped,
                isFirst: gt.isFirst,
                isLast: gt.isLast,
                groupSize: gt.groupSize,
              }}
            />
          ))}
          {groupedTickets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma demanda</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default function Kanban() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tickets, loading, updateTicketStatus, fetchTickets } = useTickets();
  const { sortTicketsWithGroups } = useTicketLinks();
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<KanbanFiltersState>({
    companyId: "",
    category: "",
    assigneeId: "",
    hasDaylog: null,
  });

  // Open ticket from URL param (e.g., when clicking notification)
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && tickets.length > 0 && !loading) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
        // Clear the URL param after opening
        setSearchParams({});
      }
    }
  }, [searchParams, tickets, loading]);

  const columns: TicketStatus[] = showArchived
    ? ["arquivado"]
    : ["novo", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido"];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Apply filters to tickets
  const filteredTickets = filterTickets(tickets, filters);

  const getGroupedTicketsByStatus = (status: TicketStatus): GroupedTicket[] => {
    const statusTickets = filteredTickets.filter((t) => t.status === status);
    return sortTicketsWithGroups(statusTickets);
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
            <h1 className="text-3xl font-bold">{showArchived ? "Demandas Arquivadas" : "Kanban de Demandas"}</h1>
            <p className="text-muted-foreground">
              {showArchived ? "Visualize as demandas arquivadas" : "Arraste os cards para mudar o status"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <KanbanFilters filters={filters} onFiltersChange={setFilters} />
            <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(!showArchived)}>
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
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
              <div className="overflow-x-auto px-4 sm:px-6 lg:px-8 scrollbar-thin">
                <div className="inline-flex gap-4 pb-4">
                  {columns.map((status) => (
                    <KanbanColumn
                      key={status}
                      status={status}
                      groupedTickets={getGroupedTicketsByStatus(status)}
                      onTicketClick={setSelectedTicket}
                    />
                  ))}
                </div>
              </div>
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
