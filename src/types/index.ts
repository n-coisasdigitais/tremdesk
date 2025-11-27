export type AppRole = 'admin' | 'team_member' | 'client_admin' | 'client_user';

export type TicketStatus = 'novo' | 'em_andamento' | 'aguardando_aprovacao' | 'aprovado' | 'concluido' | 'cancelado';

export type TicketPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type TicketCategory = 'meta_ads' | 'google_ads' | 'linkedin_ads' | 'arte' | 'relatorio' | 'outro';

export type TicketLinkType = 'related' | 'parent' | 'blocks' | 'blocked_by';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  company_id?: string;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  logo_url?: string;
  leads_system_url?: string;
  assas_portal_url?: string;
  google_drive_folder_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  company_id: string;
  created_by?: string;
  assigned_to?: string;
  title: string;
  description_json?: any;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  company?: Company;
  creator?: Profile;
  assignee?: Profile;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id?: string;
  content_json: any;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface TicketLink {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  link_type: TicketLinkType;
  created_at: string;
  created_by?: string;
  source_ticket?: Ticket;
  target_ticket?: Ticket;
}

export interface TicketChecklistItem {
  id: string;
  ticket_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
}

export interface Mention {
  id: string;
  ticket_id: string;
  comment_id?: string;
  mentioned_user_id: string;
  mentioned_by?: string;
  read_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  ticket_id?: string;
  reference_id?: string;
  read_at?: string;
  created_at: string;
}

export interface Approval {
  id: string;
  ticket_id: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'changes_requested';
  feedback_json?: any;
  created_at: string;
}
