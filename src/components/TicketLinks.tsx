import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TicketLink, TicketLinkType } from '@/types';
import { Link2, Plus, X, ArrowRight, ArrowUp, Ban, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PartialTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface TicketLinksProps {
  ticketId: string;
  companyId: string;
}

const linkTypeConfig: Record<TicketLinkType, { label: string; icon: typeof ArrowRight; color: string }> = {
  related: { label: 'Relacionada', icon: ArrowRight, color: 'bg-blue-100 text-blue-800' },
  parent: { label: 'Pai', icon: ArrowUp, color: 'bg-purple-100 text-purple-800' },
  blocks: { label: 'Bloqueia', icon: Ban, color: 'bg-red-100 text-red-800' },
  blocked_by: { label: 'Bloqueada por', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
};

export const TicketLinks = ({ ticketId, companyId }: TicketLinksProps) => {
  const { user, isAdmin, isTeamMember } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<TicketLink[]>([]);
  const [availableTickets, setAvailableTickets] = useState<PartialTicket[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedLinkType, setSelectedLinkType] = useState<TicketLinkType>('related');
  const [loading, setLoading] = useState(false);

  const canManageLinks = isAdmin || isTeamMember;

  useEffect(() => {
    fetchLinks();
  }, [ticketId]);

  const fetchLinks = async () => {
    // Fetch links where this ticket is source
    const { data: sourceLinks, error: sourceError } = await supabase
      .from('ticket_links')
      .select(`
        *,
        target_ticket:tickets!ticket_links_target_ticket_id_fkey(id, title, status, priority)
      `)
      .eq('source_ticket_id', ticketId);

    // Fetch links where this ticket is target
    const { data: targetLinks, error: targetError } = await supabase
      .from('ticket_links')
      .select(`
        *,
        source_ticket:tickets!ticket_links_source_ticket_id_fkey(id, title, status, priority)
      `)
      .eq('target_ticket_id', ticketId);

    if (sourceError || targetError) {
      console.error('Error fetching links:', sourceError || targetError);
      return;
    }

    const allLinks = [
      ...(sourceLinks || []).map((l: any) => ({ ...l, direction: 'outgoing', linkedTicket: l.target_ticket })),
      ...(targetLinks || []).map((l: any) => ({ ...l, direction: 'incoming', linkedTicket: l.source_ticket })),
    ];

    setLinks(allLinks as any);
  };

  const fetchAvailableTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, title, status, priority')
      .neq('id', ticketId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching tickets:', error);
      return;
    }

    // Filter out already linked tickets
    const linkedIds = links.map((l: any) => l.linkedTicket?.id).filter(Boolean);
    const filtered = (data || []).filter(t => !linkedIds.includes(t.id));
    setAvailableTickets(filtered);
  };

  const handleOpenDialog = () => {
    fetchAvailableTickets();
    setDialogOpen(true);
  };

  const handleAddLink = async () => {
    if (!selectedTicketId || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('ticket_links').insert([{
        source_ticket_id: ticketId,
        target_ticket_id: selectedTicketId,
        link_type: selectedLinkType,
        created_by: user.id,
      }]);

      if (error) throw error;

      toast({ title: 'Vínculo adicionado!' });
      setDialogOpen(false);
      setSelectedTicketId('');
      setSelectedLinkType('related');
      await fetchLinks();
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar vínculo', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('ticket_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast({ title: 'Vínculo removido!' });
      await fetchLinks();
    } catch (error: any) {
      toast({ title: 'Erro ao remover vínculo', description: error.message, variant: 'destructive' });
    }
  };

  const selectedTicket = availableTickets.find(t => t.id === selectedTicketId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Demandas Vinculadas
        </h4>
        {canManageLinks && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleOpenDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Vincular
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vincular Demanda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Vínculo</label>
                  <Select value={selectedLinkType} onValueChange={(v) => setSelectedLinkType(v as TicketLinkType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(linkTypeConfig).map(([value, config]) => {
                        const Icon = config.icon;
                        return (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Demanda</label>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={popoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedTicket ? (
                          <span className="truncate">{selectedTicket.title}</span>
                        ) : (
                          "Selecione uma demanda..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar demanda..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma demanda encontrada.</CommandEmpty>
                          <CommandGroup>
                            {availableTickets.map((ticket) => (
                              <CommandItem
                                key={ticket.id}
                                value={ticket.title}
                                onSelect={() => {
                                  setSelectedTicketId(ticket.id);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTicketId === ticket.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{ticket.title}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddLink} disabled={loading || !selectedTicketId}>
                    Vincular
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          Nenhuma demanda vinculada
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => {
            const config = linkTypeConfig[link.link_type as TicketLinkType];
            const Icon = config?.icon || ArrowRight;
            const linkedTicket = link.linkedTicket;

            return (
              <div
                key={link.id}
                className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted/50 group"
              >
                <Badge variant="outline" className={cn("text-xs", config?.color)}>
                  <Icon className="h-3 w-3 mr-1" />
                  {link.direction === 'incoming' ? 'De' : ''} {config?.label}
                </Badge>
                <span className="flex-1 text-sm truncate">
                  {linkedTicket?.title || 'Demanda não encontrada'}
                </span>
                {canManageLinks && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => handleRemoveLink(link.id)}
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
