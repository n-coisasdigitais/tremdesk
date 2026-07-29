import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ticket } from "@/types";

interface TicketLink {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  link_type: string;
}

export interface TicketGroup {
  groupId: string;
  ticketIds: Set<string>;
  primaryTicketId: string;
}

export function useTicketLinks() {
  const [links, setLinks] = useState<TicketLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      const { data, error } = await supabase
        .from("ticket_links")
        .select("id, source_ticket_id, target_ticket_id, link_type");

      if (!error && data) {
        setLinks(data);
      }
      setLoading(false);
    };

    fetchLinks();

    // Subscribe to realtime changes.
    // Nome único por instância evita reaproveitar um canal já inscrito quando
    // o StrictMode monta o efeito 2x em dev (removeChannel é assíncrono).
    const channel = supabase
      .channel(`ticket_links_changes_${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_links" }, () => {
        fetchLinks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Build connected groups using Union-Find algorithm
  const ticketGroups = useMemo(() => {
    const parent: Record<string, string> = {};

    const find = (x: string): string => {
      if (!parent[x]) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };

    const union = (a: string, b: string) => {
      const pa = find(a);
      const pb = find(b);
      if (pa !== pb) parent[pa] = pb;
    };

    // Union all linked tickets
    links.forEach((link) => {
      union(link.source_ticket_id, link.target_ticket_id);
    });

    // Group tickets by their root
    const groups: Record<string, Set<string>> = {};
    const allTicketIds = new Set<string>();

    links.forEach((link) => {
      allTicketIds.add(link.source_ticket_id);
      allTicketIds.add(link.target_ticket_id);
    });

    allTicketIds.forEach((id) => {
      const root = find(id);
      if (!groups[root]) groups[root] = new Set();
      groups[root].add(id);
    });

    return groups;
  }, [links]);

  // Get the group a ticket belongs to
  const getTicketGroup = (ticketId: string): string[] => {
    for (const [_, ticketIds] of Object.entries(ticketGroups)) {
      if (ticketIds.has(ticketId)) {
        return Array.from(ticketIds);
      }
    }
    return [];
  };

  // Get link count for a ticket
  const getLinkCount = (ticketId: string): number => {
    return links.filter((l) => l.source_ticket_id === ticketId || l.target_ticket_id === ticketId).length;
  };

  // Sort tickets with linked ones grouped together
  const sortTicketsWithGroups = (
    tickets: Ticket[],
  ): { ticket: Ticket; isGrouped: boolean; isFirst: boolean; isLast: boolean; groupSize: number }[] => {
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));
    const processed = new Set<string>();
    const result: { ticket: Ticket; isGrouped: boolean; isFirst: boolean; isLast: boolean; groupSize: number }[] = [];

    // Group tickets by their linked group within same status
    const statusGroups = new Map<string, Ticket[]>();
    tickets.forEach((t) => {
      if (!statusGroups.has(t.status)) statusGroups.set(t.status, []);
      statusGroups.get(t.status)!.push(t);
    });

    tickets.forEach((ticket) => {
      if (processed.has(ticket.id)) return;

      const linkedIds = getTicketGroup(ticket.id);

      if (linkedIds.length > 1) {
        // Get all linked tickets that are in the same status AND in current ticket list
        const sameStatusLinked = linkedIds
          .filter((id) => {
            const t = ticketMap.get(id);
            return t && t.status === ticket.status && !processed.has(id);
          })
          .map((id) => ticketMap.get(id)!)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (sameStatusLinked.length > 1) {
          sameStatusLinked.forEach((t, index) => {
            processed.add(t.id);
            result.push({
              ticket: t,
              isGrouped: true,
              isFirst: index === 0,
              isLast: index === sameStatusLinked.length - 1,
              groupSize: sameStatusLinked.length,
            });
          });
        } else {
          processed.add(ticket.id);
          result.push({
            ticket,
            isGrouped: false,
            isFirst: false,
            isLast: false,
            groupSize: linkedIds.length, // Total linked across all statuses
          });
        }
      } else {
        processed.add(ticket.id);
        result.push({
          ticket,
          isGrouped: false,
          isFirst: false,
          isLast: false,
          groupSize: 0,
        });
      }
    });

    return result;
  };

  return {
    links,
    loading,
    ticketGroups,
    getTicketGroup,
    getLinkCount,
    sortTicketsWithGroups,
  };
}
