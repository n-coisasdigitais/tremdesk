export type AppRole = 'super_admin' | 'admin' | 'team_member' | 'client_admin' | 'client_user';

export type TicketStatus = 'novo' | 'em_andamento' | 'aguardando_aprovacao' | 'aprovado' | 'concluido' | 'cancelado' | 'arquivado';

export type TicketPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type TicketCategory = 'meta_ads' | 'google_ads' | 'linkedin_ads' | 'arte' | 'relatorio' | 'outro';

export type TicketLinkType = 'related' | 'parent' | 'blocks' | 'blocked_by';

export type ApprovalItemStatus = 'pending' | 'approved' | 'changes_requested';

export type ApprovalIssueStatus = 'open' | 'resolved';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  can_access_daylog?: boolean;
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
  daylog_id?: string;
  requires_approval?: boolean;
  approval_assignee?: string;
  created_at: string;
  updated_at: string;
  company?: Company;
  creator?: Profile;
  assignee?: Profile;
  categories?: TicketCategoryItem[];
  watchers?: TicketWatcher[];
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

// New types for dynamic categories
export interface TicketCategoryItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  active: boolean;
  created_at: string;
  created_by?: string;
}

export interface TicketCategoryAssignment {
  id: string;
  ticket_id: string;
  category_id: string;
  created_at: string;
  category?: TicketCategoryItem;
}

// New types for watchers
export interface TicketWatcher {
  id: string;
  ticket_id: string;
  user_id: string;
  added_by?: string;
  created_at: string;
  user?: Profile;
}

// New types for approval items
export interface ApprovalItem {
  id: string;
  ticket_id: string;
  title: string;
  description?: string;
  file_url?: string;
  status: ApprovalItemStatus;
  feedback?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  created_by?: string;
  reviewer?: Profile;
  issues?: ApprovalItemIssue[];
}

export interface ApprovalItemIssue {
  id: string;
  approval_item_id: string;
  description: string;
  status: ApprovalIssueStatus;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  created_by?: string;
  resolver?: Profile;
}
