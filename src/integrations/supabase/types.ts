export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_company_exclusions: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_company_exclusions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notify_bell: boolean
          notify_email: boolean
          notify_page: boolean
          priority: string
          target_company_id: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notify_bell?: boolean
          notify_email?: boolean
          notify_page?: boolean
          priority?: string
          target_company_id?: string | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notify_bell?: boolean
          notify_email?: boolean
          notify_page?: boolean
          priority?: string
          target_company_id?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_item_issues: {
        Row: {
          approval_item_id: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          approval_item_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          approval_item_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_item_issues_approval_item_id_fkey"
            columns: ["approval_item_id"]
            isOneToOne: false
            referencedRelation: "approval_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_item_issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_item_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          feedback: string | null
          file_url: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          ticket_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          ticket_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          ticket_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          feedback_json: Json | null
          id: string
          status: string
          ticket_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          feedback_json?: Json | null
          id?: string
          status?: string
          ticket_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          feedback_json?: Json | null
          id?: string
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          assas_portal_url: string | null
          created_at: string
          google_drive_folder_id: string | null
          id: string
          leads_system_url: string | null
          logo_url: string | null
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          assas_portal_url?: string | null
          created_at?: string
          google_drive_folder_id?: string | null
          id?: string
          leads_system_url?: string | null
          logo_url?: string | null
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          assas_portal_url?: string | null
          created_at?: string
          google_drive_folder_id?: string | null
          id?: string
          leads_system_url?: string | null
          logo_url?: string | null
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      day_log_attachments: {
        Row: {
          created_at: string | null
          day_log_id: string
          file_name: string
          file_type: string | null
          file_url: string
          google_drive_file_id: string | null
          google_drive_folder_id: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          day_log_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          day_log_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_log_attachments_day_log_id_fkey"
            columns: ["day_log_id"]
            isOneToOne: false
            referencedRelation: "day_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      day_logs: {
        Row: {
          ai_assistant_url: string | null
          company_id: string | null
          created_at: string | null
          date: string
          description: string | null
          google_doc_id: string | null
          google_doc_url: string | null
          id: string
          meeting_notes: string | null
          next_steps: string | null
          next_steps_json: Json | null
          tags: string[] | null
          transcription_url: string | null
          updated_at: string | null
          user_id: string
          work_done: string
          work_done_json: Json | null
          work_pending: string | null
          work_pending_json: Json | null
        }
        Insert: {
          ai_assistant_url?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          google_doc_id?: string | null
          google_doc_url?: string | null
          id?: string
          meeting_notes?: string | null
          next_steps?: string | null
          next_steps_json?: Json | null
          tags?: string[] | null
          transcription_url?: string | null
          updated_at?: string | null
          user_id: string
          work_done: string
          work_done_json?: Json | null
          work_pending?: string | null
          work_pending_json?: Json | null
        }
        Update: {
          ai_assistant_url?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          google_doc_id?: string | null
          google_doc_url?: string | null
          id?: string
          meeting_notes?: string | null
          next_steps?: string | null
          next_steps_json?: Json | null
          tags?: string[] | null
          transcription_url?: string | null
          updated_at?: string | null
          user_id?: string
          work_done?: string
          work_done_json?: Json | null
          work_pending?: string | null
          work_pending_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "day_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daylog_comments: {
        Row: {
          content_json: Json
          created_at: string
          day_log_id: string
          id: string
          parent_comment_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content_json: Json
          created_at?: string
          day_log_id: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content_json?: Json
          created_at?: string
          day_log_id?: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daylog_comments_day_log_id_fkey"
            columns: ["day_log_id"]
            isOneToOne: false
            referencedRelation: "day_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daylog_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "daylog_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      daylog_email_sends: {
        Row: {
          day_log_id: string
          id: string
          sent_at: string
          sent_by: string | null
          sent_to: string[]
          subject: string | null
        }
        Insert: {
          day_log_id: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_to: string[]
          subject?: string | null
        }
        Update: {
          day_log_id?: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_to?: string[]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daylog_email_sends_day_log_id_fkey"
            columns: ["day_log_id"]
            isOneToOne: false
            referencedRelation: "day_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      daylog_tags: {
        Row: {
          active: boolean | null
          bg_color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          text_color: string | null
        }
        Insert: {
          active?: boolean | null
          bg_color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          text_color?: string | null
        }
        Update: {
          active?: boolean | null
          bg_color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          text_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daylog_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          source: string | null
          ticket_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          ticket_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          ticket_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mentions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          mentioned_by: string | null
          mentioned_user_id: string
          read_at: string | null
          ticket_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_by?: string | null
          mentioned_user_id: string
          read_at?: string | null
          ticket_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_by?: string | null
          mentioned_user_id?: string
          read_at?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioned_by_fkey"
            columns: ["mentioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          read_at: string | null
          reference_id: string | null
          ticket_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string | null
          reference_id?: string | null
          ticket_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string | null
          reference_id?: string | null
          ticket_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_access_daylog: boolean
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_access_daylog?: boolean
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_access_daylog?: boolean
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string
          email: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by: string
          email: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_clients: {
        Row: {
          company_id: string
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_activities: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata_json: Json | null
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata_json?: Json | null
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata_json?: Json | null
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activities_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          google_drive_file_id: string | null
          google_drive_folder_id: string | null
          id: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          google_drive_file_id?: string | null
          google_drive_folder_id?: string | null
          id?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_category_assignments: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          ticket_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          ticket_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_category_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          content: string
          created_at: string
          id: string
          is_completed: boolean
          position: number
          ticket_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          content: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          ticket_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          content?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          content_json: Json
          created_at: string
          id: string
          parent_comment_id: string | null
          ticket_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content_json: Json
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          ticket_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content_json?: Json
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          ticket_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          source_ticket_id: string
          target_ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          source_ticket_id: string
          target_ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          source_ticket_id?: string
          target_ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_links_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_links_target_ticket_id_fkey"
            columns: ["target_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_watchers: {
        Row: {
          added_by: string | null
          created_at: string | null
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_watchers_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          approval_assignee: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          daylog_id: string | null
          description_json: Json | null
          due_date: string | null
          id: string
          origem: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          protocolo: string | null
          requires_approval: boolean | null
          solicitante_email: string | null
          solicitante_nome: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          token_acompanhamento: string | null
          updated_at: string
        }
        Insert: {
          approval_assignee?: string | null
          assigned_to?: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daylog_id?: string | null
          description_json?: Json | null
          due_date?: string | null
          id?: string
          origem?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocolo?: string | null
          requires_approval?: boolean | null
          solicitante_email?: string | null
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          token_acompanhamento?: string | null
          updated_at?: string
        }
        Update: {
          approval_assignee?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daylog_id?: string | null
          description_json?: Json | null
          due_date?: string | null
          id?: string
          origem?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          protocolo?: string | null
          requires_approval?: boolean | null
          solicitante_email?: string | null
          solicitante_nome?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          token_acompanhamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_approval_assignee_fkey"
            columns: ["approval_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_daylog_id_fkey"
            columns: ["daylog_id"]
            isOneToOne: false
            referencedRelation: "day_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_can_access_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      generate_protocolo: { Args: never; Returns: string }
      get_ticket_by_token: {
        Args: { p_token: string }
        Returns: {
          category: string
          company_name: string
          completed_at: string
          created_at: string
          protocolo: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_user: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      team_has_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "team_member"
        | "client_admin"
        | "client_user"
        | "super_admin"
      ticket_category:
        | "meta_ads"
        | "google_ads"
        | "linkedin_ads"
        | "arte"
        | "relatorio"
        | "outro"
      ticket_priority: "baixa" | "media" | "alta" | "urgente"
      ticket_status:
        | "novo"
        | "em_andamento"
        | "aguardando_aprovacao"
        | "aprovado"
        | "concluido"
        | "cancelado"
        | "arquivado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "team_member",
        "client_admin",
        "client_user",
        "super_admin",
      ],
      ticket_category: [
        "meta_ads",
        "google_ads",
        "linkedin_ads",
        "arte",
        "relatorio",
        "outro",
      ],
      ticket_priority: ["baixa", "media", "alta", "urgente"],
      ticket_status: [
        "novo",
        "em_andamento",
        "aguardando_aprovacao",
        "aprovado",
        "concluido",
        "cancelado",
        "arquivado",
      ],
    },
  },
} as const
