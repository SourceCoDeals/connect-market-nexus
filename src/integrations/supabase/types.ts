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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_connection_requests_views: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          last_viewed_at: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_deal_sourcing_views: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          last_viewed_at: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_deal_sourcing_views_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          action_url: string | null
          admin_id: string
          created_at: string | null
          deal_id: string | null
          feedback_id: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          admin_id: string
          created_at?: string | null
          deal_id?: string | null
          feedback_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          admin_id?: string
          created_at?: string | null
          deal_id?: string | null
          feedback_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "deal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_signature_preferences: {
        Row: {
          admin_id: string
          calendly_url: string | null
          created_at: string
          id: string
          phone_number: string | null
          signature_html: string
          signature_text: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          calendly_url?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          signature_html: string
          signature_text: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          calendly_url?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          signature_html?: string
          signature_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users_views: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          last_viewed_at: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          last_viewed_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      alert_delivery_logs: {
        Row: {
          alert_id: string
          created_at: string
          delivery_status: string
          error_message: string | null
          id: string
          listing_id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          listing_id: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          listing_id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_delivery_logs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "deal_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          admin_id: string | null
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          table_name: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          table_name: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          table_name?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          listing_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          listing_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connection_request_contacts: {
        Row: {
          created_at: string
          id: string
          primary_request_id: string
          related_request_id: string
          relationship_metadata: Json
          relationship_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          primary_request_id: string
          related_request_id: string
          relationship_metadata?: Json
          relationship_type: string
        }
        Update: {
          created_at?: string
          id?: string
          primary_request_id?: string
          related_request_id?: string
          relationship_metadata?: Json
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_request_contacts_primary_request_id_fkey"
            columns: ["primary_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_request_contacts_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_request_stages: {
        Row: {
          automation_rules: Json | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          position: number
          updated_at: string | null
        }
        Insert: {
          automation_rules?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          position: number
          updated_at?: string | null
        }
        Update: {
          automation_rules?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      connection_requests: {
        Row: {
          admin_comment: string | null
          approved_at: string | null
          approved_by: string | null
          buyer_priority_score: number | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          decision_at: string | null
          decision_notes: string | null
          firm_id: string | null
          followed_up: boolean | null
          followed_up_at: string | null
          followed_up_by: string | null
          id: string
          lead_company: string | null
          lead_email: string | null
          lead_fee_agreement_email_sent: boolean | null
          lead_fee_agreement_email_sent_at: string | null
          lead_fee_agreement_email_sent_by: string | null
          lead_fee_agreement_signed: boolean | null
          lead_fee_agreement_signed_at: string | null
          lead_fee_agreement_signed_by: string | null
          lead_name: string | null
          lead_nda_email_sent: boolean | null
          lead_nda_email_sent_at: string | null
          lead_nda_email_sent_by: string | null
          lead_nda_signed: boolean | null
          lead_nda_signed_at: string | null
          lead_nda_signed_by: string | null
          lead_phone: string | null
          lead_role: string | null
          listing_id: string
          negative_followed_up: boolean | null
          negative_followed_up_at: string | null
          negative_followed_up_by: string | null
          on_hold_at: string | null
          on_hold_by: string | null
          pipeline_stage_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          source: string | null
          source_lead_id: string | null
          source_metadata: Json | null
          stage_entered_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          user_message: string | null
        }
        Insert: {
          admin_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_priority_score?: number | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          decision_at?: string | null
          decision_notes?: string | null
          firm_id?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          lead_company?: string | null
          lead_email?: string | null
          lead_fee_agreement_email_sent?: boolean | null
          lead_fee_agreement_email_sent_at?: string | null
          lead_fee_agreement_email_sent_by?: string | null
          lead_fee_agreement_signed?: boolean | null
          lead_fee_agreement_signed_at?: string | null
          lead_fee_agreement_signed_by?: string | null
          lead_name?: string | null
          lead_nda_email_sent?: boolean | null
          lead_nda_email_sent_at?: string | null
          lead_nda_email_sent_by?: string | null
          lead_nda_signed?: boolean | null
          lead_nda_signed_at?: string | null
          lead_nda_signed_by?: string | null
          lead_phone?: string | null
          lead_role?: string | null
          listing_id: string
          negative_followed_up?: boolean | null
          negative_followed_up_at?: string | null
          negative_followed_up_by?: string | null
          on_hold_at?: string | null
          on_hold_by?: string | null
          pipeline_stage_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          source?: string | null
          source_lead_id?: string | null
          source_metadata?: Json | null
          stage_entered_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          user_message?: string | null
        }
        Update: {
          admin_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_priority_score?: number | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          decision_at?: string | null
          decision_notes?: string | null
          firm_id?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          lead_company?: string | null
          lead_email?: string | null
          lead_fee_agreement_email_sent?: boolean | null
          lead_fee_agreement_email_sent_at?: string | null
          lead_fee_agreement_email_sent_by?: string | null
          lead_fee_agreement_signed?: boolean | null
          lead_fee_agreement_signed_at?: string | null
          lead_fee_agreement_signed_by?: string | null
          lead_name?: string | null
          lead_nda_email_sent?: boolean | null
          lead_nda_email_sent_at?: string | null
          lead_nda_email_sent_by?: string | null
          lead_nda_signed?: boolean | null
          lead_nda_signed_at?: string | null
          lead_nda_signed_by?: string | null
          lead_phone?: string | null
          lead_role?: string | null
          listing_id?: string
          negative_followed_up?: boolean | null
          negative_followed_up_at?: string | null
          negative_followed_up_by?: string | null
          on_hold_at?: string | null
          on_hold_by?: string | null
          pipeline_stage_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          source?: string | null
          source_lead_id?: string | null
          source_metadata?: Json | null
          stage_entered_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "connection_request_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "inbound_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          active_users: number | null
          avg_session_duration: number | null
          bounce_rate: number | null
          connection_requests: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          listing_views: number | null
          new_listings: number | null
          new_signups: number | null
          page_views: number | null
          returning_users: number | null
          searches_performed: number | null
          successful_connections: number | null
          total_sessions: number | null
          total_users: number | null
          unique_page_views: number | null
          updated_at: string | null
        }
        Insert: {
          active_users?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          connection_requests?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          listing_views?: number | null
          new_listings?: number | null
          new_signups?: number | null
          page_views?: number | null
          returning_users?: number | null
          searches_performed?: number | null
          successful_connections?: number | null
          total_sessions?: number | null
          total_users?: number | null
          unique_page_views?: number | null
          updated_at?: string | null
        }
        Update: {
          active_users?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          connection_requests?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          listing_views?: number | null
          new_listings?: number | null
          new_signups?: number | null
          page_views?: number | null
          returning_users?: number | null
          searches_performed?: number | null
          successful_connections?: number | null
          total_sessions?: number | null
          total_users?: number | null
          unique_page_views?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          admin_id: string | null
          created_at: string | null
          deal_id: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          activity_type: string
          admin_id?: string | null
          created_at?: string | null
          deal_id: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          activity_type?: string
          admin_id?: string | null
          created_at?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_alerts: {
        Row: {
          created_at: string
          criteria: Json
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_comments: {
        Row: {
          admin_id: string
          comment_text: string
          created_at: string
          deal_id: string
          id: string
          mentioned_admins: string[]
          updated_at: string
        }
        Insert: {
          admin_id: string
          comment_text: string
          created_at?: string
          deal_id: string
          id?: string
          mentioned_admins?: string[]
          updated_at?: string
        }
        Update: {
          admin_id?: string
          comment_text?: string
          created_at?: string
          deal_id?: string
          id?: string
          mentioned_admins?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_comments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          admin_id: string
          contact_details: Json | null
          contact_type: string
          created_at: string | null
          deal_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          contact_details?: Json | null
          contact_type: string
          created_at?: string | null
          deal_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          contact_details?: Json | null
          contact_type?: string
          created_at?: string | null
          deal_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          admin_id: string
          created_at: string
          deal_id: string
          id: string
          note_text: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          deal_id: string
          id?: string
          note_text: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          note_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_referrals: {
        Row: {
          cc_sender: boolean | null
          converted: boolean
          converted_at: string | null
          created_at: string
          delivery_status: string | null
          id: string
          listing_id: string
          opened: boolean
          opened_at: string | null
          personal_message: string | null
          recipient_email: string
          recipient_name: string | null
          referrer_user_id: string | null
          sent_at: string | null
        }
        Insert: {
          cc_sender?: boolean | null
          converted?: boolean
          converted_at?: string | null
          created_at?: string
          delivery_status?: string | null
          id?: string
          listing_id: string
          opened?: boolean
          opened_at?: string | null
          personal_message?: string | null
          recipient_email: string
          recipient_name?: string | null
          referrer_user_id?: string | null
          sent_at?: string | null
        }
        Update: {
          cc_sender?: boolean | null
          converted?: boolean
          converted_at?: string | null
          created_at?: string
          delivery_status?: string | null
          id?: string
          listing_id?: string
          opened?: boolean
          opened_at?: string | null
          personal_message?: string | null
          recipient_email?: string
          recipient_name?: string | null
          referrer_user_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_referrals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_referrals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_sourcing_requests: {
        Row: {
          additional_notes: string | null
          admin_notes: string | null
          assigned_to: string | null
          business_categories: string[] | null
          buyer_type: string | null
          converted_to_deal_id: string | null
          created_at: string | null
          custom_message: string | null
          followed_up_at: string | null
          id: string
          investment_thesis: string | null
          revenue_max: string | null
          revenue_min: string | null
          status: string | null
          target_locations: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          admin_notes?: string | null
          assigned_to?: string | null
          business_categories?: string[] | null
          buyer_type?: string | null
          converted_to_deal_id?: string | null
          created_at?: string | null
          custom_message?: string | null
          followed_up_at?: string | null
          id?: string
          investment_thesis?: string | null
          revenue_max?: string | null
          revenue_min?: string | null
          status?: string | null
          target_locations?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          admin_notes?: string | null
          assigned_to?: string | null
          business_categories?: string[] | null
          buyer_type?: string | null
          converted_to_deal_id?: string | null
          created_at?: string | null
          custom_message?: string | null
          followed_up_at?: string | null
          id?: string
          investment_thesis?: string | null
          revenue_max?: string | null
          revenue_min?: string | null
          status?: string | null
          target_locations?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_sourcing_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_sourcing_requests_converted_to_deal_id_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_sourcing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          automation_rules: Json | null
          color: string | null
          created_at: string | null
          default_probability: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_system_stage: boolean | null
          name: string
          position: number
          stage_type: string | null
          updated_at: string | null
        }
        Insert: {
          automation_rules?: Json | null
          color?: string | null
          created_at?: string | null
          default_probability?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system_stage?: boolean | null
          name: string
          position: number
          stage_type?: string | null
          updated_at?: string | null
        }
        Update: {
          automation_rules?: Json | null
          color?: string | null
          created_at?: string | null
          default_probability?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_system_stage?: boolean | null
          name?: string
          position?: number
          stage_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_task_reviewers: {
        Row: {
          added_at: string | null
          added_by: string | null
          admin_id: string
          id: string
          task_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          admin_id: string
          id?: string
          task_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          admin_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_task_reviewers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "deal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          buyer_priority_score: number | null
          connection_request_id: string | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          fee_agreement_status: string | null
          followed_up: boolean | null
          followed_up_at: string | null
          followed_up_by: string | null
          id: string
          inbound_lead_id: string | null
          listing_id: string | null
          metadata: Json | null
          nda_status: string | null
          negative_followed_up: boolean | null
          negative_followed_up_at: string | null
          negative_followed_up_by: string | null
          owner_assigned_at: string | null
          owner_assigned_by: string | null
          priority: string | null
          probability: number | null
          source: string | null
          stage_entered_at: string | null
          stage_id: string
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          buyer_priority_score?: number | null
          connection_request_id?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          fee_agreement_status?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          inbound_lead_id?: string | null
          listing_id?: string | null
          metadata?: Json | null
          nda_status?: string | null
          negative_followed_up?: boolean | null
          negative_followed_up_at?: string | null
          negative_followed_up_by?: string | null
          owner_assigned_at?: string | null
          owner_assigned_by?: string | null
          priority?: string | null
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id: string
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          buyer_priority_score?: number | null
          connection_request_id?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          fee_agreement_status?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          inbound_lead_id?: string | null
          listing_id?: string | null
          metadata?: Json | null
          nda_status?: string | null
          negative_followed_up?: boolean | null
          negative_followed_up_at?: string | null
          negative_followed_up_by?: string | null
          owner_assigned_at?: string | null
          owner_assigned_by?: string | null
          priority?: string | null
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_connection_request_id_fkey"
            columns: ["connection_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_followed_up_by_fkey"
            columns: ["followed_up_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_inbound_lead_id_fkey"
            columns: ["inbound_lead_id"]
            isOneToOne: false
            referencedRelation: "inbound_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_assigned_by_fkey"
            columns: ["owner_assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_logs: {
        Row: {
          correlation_id: string
          created_at: string
          email: string
          email_type: string
          error_message: string | null
          id: string
          max_retries: number
          retry_count: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          correlation_id: string
          created_at?: string
          email: string
          email_type: string
          error_message?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          correlation_id?: string
          created_at?: string
          email?: string
          email_type?: string
          error_message?: string | null
          id?: string
          max_retries?: number
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      engagement_scores: {
        Row: {
          activity_streak: number | null
          avg_session_duration: number | null
          bounce_rate: number | null
          churn_risk_score: number | null
          connections_requested: number
          conversion_events: number | null
          created_at: string
          days_since_signup: number | null
          id: string
          last_active: string | null
          last_login: string | null
          listings_saved: number
          listings_viewed: number
          page_views: number | null
          score: number
          search_count: number | null
          session_count: number | null
          total_session_time: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_streak?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          churn_risk_score?: number | null
          connections_requested?: number
          conversion_events?: number | null
          created_at?: string
          days_since_signup?: number | null
          id?: string
          last_active?: string | null
          last_login?: string | null
          listings_saved?: number
          listings_viewed?: number
          page_views?: number | null
          score?: number
          search_count?: number | null
          session_count?: number | null
          total_session_time?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_streak?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          churn_risk_score?: number | null
          connections_requested?: number
          conversion_events?: number | null
          created_at?: string
          days_since_signup?: number | null
          id?: string
          last_active?: string | null
          last_login?: string | null
          listings_saved?: number
          listings_viewed?: number
          page_views?: number | null
          score?: number
          search_count?: number | null
          session_count?: number | null
          total_session_time?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_agreement_logs: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: string | null
          admin_name: string | null
          created_at: string
          email_sent_to: string | null
          firm_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string
          email_sent_to?: string | null
          firm_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string
          email_sent_to?: string | null
          firm_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_agreement_logs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_messages: {
        Row: {
          admin_id: string | null
          admin_response: string | null
          category: string | null
          created_at: string
          id: string
          message: string
          page_url: string | null
          priority: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          priority?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          admin_response?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          priority?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      filter_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      firm_agreements: {
        Row: {
          company_name_variations: Json | null
          created_at: string
          email_domain: string | null
          fee_agreement_email_sent: boolean | null
          fee_agreement_email_sent_at: string | null
          fee_agreement_email_sent_by: string | null
          fee_agreement_signed: boolean | null
          fee_agreement_signed_at: string | null
          fee_agreement_signed_by: string | null
          fee_agreement_signed_by_name: string | null
          id: string
          member_count: number | null
          metadata: Json | null
          nda_email_sent: boolean | null
          nda_email_sent_at: string | null
          nda_email_sent_by: string | null
          nda_signed: boolean | null
          nda_signed_at: string | null
          nda_signed_by: string | null
          nda_signed_by_name: string | null
          normalized_company_name: string
          primary_company_name: string
          updated_at: string
          website_domain: string | null
        }
        Insert: {
          company_name_variations?: Json | null
          created_at?: string
          email_domain?: string | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_email_sent_by?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          fee_agreement_signed_by?: string | null
          fee_agreement_signed_by_name?: string | null
          id?: string
          member_count?: number | null
          metadata?: Json | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_email_sent_by?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          nda_signed_by?: string | null
          nda_signed_by_name?: string | null
          normalized_company_name: string
          primary_company_name: string
          updated_at?: string
          website_domain?: string | null
        }
        Update: {
          company_name_variations?: Json | null
          created_at?: string
          email_domain?: string | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_email_sent_by?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          fee_agreement_signed_by?: string | null
          fee_agreement_signed_by_name?: string | null
          id?: string
          member_count?: number | null
          metadata?: Json | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_email_sent_by?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          nda_signed_by?: string | null
          nda_signed_by_name?: string | null
          normalized_company_name?: string
          primary_company_name?: string
          updated_at?: string
          website_domain?: string | null
        }
        Relationships: []
      }
      firm_members: {
        Row: {
          added_at: string
          added_by: string | null
          connection_request_id: string | null
          firm_id: string
          id: string
          inbound_lead_id: string | null
          is_primary_contact: boolean | null
          lead_company: string | null
          lead_email: string | null
          lead_name: string | null
          member_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          connection_request_id?: string | null
          firm_id: string
          id?: string
          inbound_lead_id?: string | null
          is_primary_contact?: boolean | null
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          member_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          connection_request_id?: string | null
          firm_id?: string
          id?: string
          inbound_lead_id?: string | null
          is_primary_contact?: boolean | null
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          member_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_connection_request_id_fkey"
            columns: ["connection_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_members_inbound_lead_id_fkey"
            columns: ["inbound_lead_id"]
            isOneToOne: false
            referencedRelation: "inbound_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_leads: {
        Row: {
          company_name: string | null
          converted_at: string | null
          converted_by: string | null
          converted_to_request_id: string | null
          created_at: string
          duplicate_info: string | null
          email: string
          firm_id: string | null
          id: string
          is_duplicate: boolean | null
          mapped_at: string | null
          mapped_by: string | null
          mapped_to_listing_id: string | null
          mapped_to_listing_title: string | null
          message: string | null
          name: string
          phone_number: string | null
          priority_score: number
          role: string | null
          source: string
          source_form_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_request_id?: string | null
          created_at?: string
          duplicate_info?: string | null
          email: string
          firm_id?: string | null
          id?: string
          is_duplicate?: boolean | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_to_listing_id?: string | null
          mapped_to_listing_title?: string | null
          message?: string | null
          name: string
          phone_number?: string | null
          priority_score?: number
          role?: string | null
          source?: string
          source_form_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_request_id?: string | null
          created_at?: string
          duplicate_info?: string | null
          email?: string
          firm_id?: string | null
          id?: string
          is_duplicate?: boolean | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_to_listing_id?: string | null
          mapped_to_listing_title?: string | null
          message?: string | null
          name?: string
          phone_number?: string | null
          priority_score?: number
          role?: string | null
          source?: string
          source_form_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_leads_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_converted_to_request_id_fkey"
            columns: ["converted_to_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_mapped_to_listing_id_fkey"
            columns: ["mapped_to_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_mapped_to_listing_id_fkey"
            columns: ["mapped_to_listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_analytics: {
        Row: {
          action_type: string
          clicked_elements: Json | null
          created_at: string | null
          id: string
          listing_id: string | null
          referrer_page: string | null
          scroll_depth: number | null
          search_query: string | null
          session_id: string | null
          time_spent: number | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          action_type: string
          clicked_elements?: Json | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          referrer_page?: string | null
          scroll_depth?: number | null
          search_query?: string | null
          session_id?: string | null
          time_spent?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          action_type?: string
          clicked_elements?: Json | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          referrer_page?: string | null
          scroll_depth?: number | null
          search_query?: string | null
          session_id?: string | null
          time_spent?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_conversations: {
        Row: {
          admin_id: string | null
          connection_request_id: string
          created_at: string
          id: string
          listing_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          connection_request_id: string
          created_at?: string
          id?: string
          listing_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          connection_request_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conversations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_connection_request_id_fkey"
            columns: ["connection_request_id"]
            isOneToOne: true
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_messages: {
        Row: {
          attachments: Json | null
          conversation_id: string
          created_at: string
          id: string
          is_internal_note: boolean
          message_text: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          attachments?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          message_text: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          attachments?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          message_text?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "listing_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_personal_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          acquisition_type: string | null
          categories: string[] | null
          category: string
          created_at: string
          custom_metric_label: string | null
          custom_metric_subtitle: string | null
          custom_metric_value: string | null
          custom_sections: Json | null
          customer_concentration: number | null
          deal_identifier: string | null
          deleted_at: string | null
          description: string
          description_html: string | null
          description_json: Json | null
          ebitda: number
          ebitda_metric_subtitle: string | null
          files: string[] | null
          full_time_employees: number | null
          growth_drivers: Json | null
          hero_description: string | null
          id: string
          image_url: string | null
          internal_company_name: string | null
          internal_contact_info: string | null
          internal_deal_memo_link: string | null
          internal_notes: string | null
          internal_primary_owner: string | null
          internal_salesforce_link: string | null
          investment_thesis: string | null
          key_risks: Json | null
          location: string
          management_depth: string | null
          market_position: Json | null
          metric_3_custom_label: string | null
          metric_3_custom_subtitle: string | null
          metric_3_custom_value: string | null
          metric_3_type: string | null
          metric_4_custom_label: string | null
          metric_4_custom_subtitle: string | null
          metric_4_custom_value: string | null
          metric_4_type: string | null
          owner_notes: string | null
          ownership_structure: string | null
          part_time_employees: number | null
          presented_by_admin_id: string | null
          primary_owner_id: string | null
          revenue: number
          revenue_metric_subtitle: string | null
          revenue_model_breakdown: Json | null
          seller_involvement_preference: string | null
          seller_motivation: string | null
          status: string
          status_tag: string | null
          tags: string[] | null
          timeline_preference: string | null
          title: string
          transaction_preferences: Json | null
          updated_at: string
          visible_to_buyer_types: string[] | null
        }
        Insert: {
          acquisition_type?: string | null
          categories?: string[] | null
          category: string
          created_at?: string
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          deal_identifier?: string | null
          deleted_at?: string | null
          description: string
          description_html?: string | null
          description_json?: Json | null
          ebitda: number
          ebitda_metric_subtitle?: string | null
          files?: string[] | null
          full_time_employees?: number | null
          growth_drivers?: Json | null
          hero_description?: string | null
          id?: string
          image_url?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          key_risks?: Json | null
          location: string
          management_depth?: string | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          owner_notes?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_owner_id?: string | null
          revenue: number
          revenue_metric_subtitle?: string | null
          revenue_model_breakdown?: Json | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          status?: string
          status_tag?: string | null
          tags?: string[] | null
          timeline_preference?: string | null
          title: string
          transaction_preferences?: Json | null
          updated_at?: string
          visible_to_buyer_types?: string[] | null
        }
        Update: {
          acquisition_type?: string | null
          categories?: string[] | null
          category?: string
          created_at?: string
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          deal_identifier?: string | null
          deleted_at?: string | null
          description?: string
          description_html?: string | null
          description_json?: Json | null
          ebitda?: number
          ebitda_metric_subtitle?: string | null
          files?: string[] | null
          full_time_employees?: number | null
          growth_drivers?: Json | null
          hero_description?: string | null
          id?: string
          image_url?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          key_risks?: Json | null
          location?: string
          management_depth?: string | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          owner_notes?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_owner_id?: string | null
          revenue?: number
          revenue_metric_subtitle?: string | null
          revenue_model_breakdown?: Json | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          status?: string
          status_tag?: string | null
          tags?: string[] | null
          timeline_preference?: string | null
          title?: string
          transaction_preferences?: Json | null
          updated_at?: string
          visible_to_buyer_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_presented_by_admin_id_fkey"
            columns: ["presented_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_primary_owner_id_fkey"
            columns: ["primary_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nda_logs: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: string | null
          admin_name: string | null
          created_at: string
          email_sent_to: string | null
          firm_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string
          email_sent_to?: string | null
          firm_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string
          email_sent_to?: string | null
          firm_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nda_logs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_rate_limits: {
        Row: {
          created_at: string
          email: string
          id: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      owner_intro_notifications: {
        Row: {
          created_at: string | null
          deal_id: string
          email_error: string | null
          email_status: string | null
          id: string
          listing_id: string
          metadata: Json | null
          primary_owner_id: string
          sent_at: string | null
          sent_by: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          email_error?: string | null
          email_status?: string | null
          id?: string
          listing_id: string
          metadata?: Json | null
          primary_owner_id: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          email_error?: string | null
          email_status?: string | null
          id?: string
          listing_id?: string
          metadata?: Json | null
          primary_owner_id?: string
          sent_at?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_intro_notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intro_notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intro_notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intro_notifications_primary_owner_id_fkey"
            columns: ["primary_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intro_notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string | null
          exit_page: boolean | null
          id: string
          page_path: string
          page_title: string | null
          referrer: string | null
          scroll_depth: number | null
          session_id: string | null
          time_on_page: number | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string | null
          exit_page?: boolean | null
          id?: string
          page_path: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string | null
          time_on_page?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string | null
          exit_page?: boolean | null
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string | null
          time_on_page?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"] | null
          reason: string | null
          target_user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          target_user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role?: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      pipeline_views: {
        Row: {
          created_at: string
          description: string | null
          filter_config: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          stage_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          stage_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          stage_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profile_data_snapshots: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          raw_business_categories: Json | null
          raw_payload: Json | null
          raw_target_locations: Json | null
          snapshot_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          raw_business_categories?: Json | null
          raw_payload?: Json | null
          raw_target_locations?: Json | null
          snapshot_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          raw_business_categories?: Json | null
          raw_payload?: Json | null
          raw_target_locations?: Json | null
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_data_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acq_equity_band: string | null
          anchor_investors_summary: string | null
          approval_status: string
          aum: string | null
          backers_summary: string | null
          bio: string | null
          business_categories: Json | null
          buyer_org_url: string | null
          buyer_role: string | null
          buyer_type: string | null
          committed_equity_band: string | null
          company: string | null
          company_name: string | null
          corpdev_intent: string | null
          created_at: string
          deal_intent: string | null
          deal_size_band: string | null
          deal_structure_preference: string | null
          deleted_at: string | null
          deploying_capital_now: string | null
          deployment_timing: string | null
          discretion_type: string | null
          email: string
          email_verified: boolean
          equity_source: Json | null
          estimated_revenue: string | null
          exclusions: Json | null
          fee_agreement_email_sent: boolean | null
          fee_agreement_email_sent_at: string | null
          fee_agreement_signed: boolean | null
          fee_agreement_signed_at: string | null
          financing_plan: Json | null
          first_name: string
          flex_sub2m_ebitda: boolean | null
          flex_subxm_ebitda: boolean | null
          fund_size: string | null
          funded_by: string | null
          funding_source: string | null
          geographic_focus: Json | null
          id: string
          ideal_target: string | null
          ideal_target_description: string | null
          include_keywords: Json | null
          industry_expertise: Json | null
          integration_plan: Json | null
          investment_size: Json | null
          is_admin: boolean | null
          is_funded: string | null
          job_title: string | null
          last_name: string
          linkedin_profile: string
          mandate_blurb: string | null
          max_equity_today_band: string | null
          nda_email_sent: boolean | null
          nda_email_sent_at: string | null
          nda_signed: boolean | null
          nda_signed_at: string | null
          needs_loan: string | null
          on_behalf_of_buyer: string | null
          onboarding_completed: boolean | null
          operating_company_targets: Json | null
          owner_intent: string | null
          owner_timeline: string | null
          owning_business_unit: string | null
          permanent_capital: boolean | null
          phone_number: string | null
          portfolio_company_addon: string | null
          revenue_range_max: string | null
          revenue_range_min: string | null
          search_stage: string | null
          search_type: string | null
          specific_business_search: string | null
          target_company_size: string | null
          target_deal_size_max: number | null
          target_deal_size_min: number | null
          target_locations: Json | null
          updated_at: string
          uses_bank_finance: string | null
          website: string
        }
        Insert: {
          acq_equity_band?: string | null
          anchor_investors_summary?: string | null
          approval_status?: string
          aum?: string | null
          backers_summary?: string | null
          bio?: string | null
          business_categories?: Json | null
          buyer_org_url?: string | null
          buyer_role?: string | null
          buyer_type?: string | null
          committed_equity_band?: string | null
          company?: string | null
          company_name?: string | null
          corpdev_intent?: string | null
          created_at?: string
          deal_intent?: string | null
          deal_size_band?: string | null
          deal_structure_preference?: string | null
          deleted_at?: string | null
          deploying_capital_now?: string | null
          deployment_timing?: string | null
          discretion_type?: string | null
          email: string
          email_verified?: boolean
          equity_source?: Json | null
          estimated_revenue?: string | null
          exclusions?: Json | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          financing_plan?: Json | null
          first_name: string
          flex_sub2m_ebitda?: boolean | null
          flex_subxm_ebitda?: boolean | null
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          geographic_focus?: Json | null
          id: string
          ideal_target?: string | null
          ideal_target_description?: string | null
          include_keywords?: Json | null
          industry_expertise?: Json | null
          integration_plan?: Json | null
          investment_size?: Json | null
          is_admin?: boolean | null
          is_funded?: string | null
          job_title?: string | null
          last_name: string
          linkedin_profile: string
          mandate_blurb?: string | null
          max_equity_today_band?: string | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          needs_loan?: string | null
          on_behalf_of_buyer?: string | null
          onboarding_completed?: boolean | null
          operating_company_targets?: Json | null
          owner_intent?: string | null
          owner_timeline?: string | null
          owning_business_unit?: string | null
          permanent_capital?: boolean | null
          phone_number?: string | null
          portfolio_company_addon?: string | null
          revenue_range_max?: string | null
          revenue_range_min?: string | null
          search_stage?: string | null
          search_type?: string | null
          specific_business_search?: string | null
          target_company_size?: string | null
          target_deal_size_max?: number | null
          target_deal_size_min?: number | null
          target_locations?: Json | null
          updated_at?: string
          uses_bank_finance?: string | null
          website: string
        }
        Update: {
          acq_equity_band?: string | null
          anchor_investors_summary?: string | null
          approval_status?: string
          aum?: string | null
          backers_summary?: string | null
          bio?: string | null
          business_categories?: Json | null
          buyer_org_url?: string | null
          buyer_role?: string | null
          buyer_type?: string | null
          committed_equity_band?: string | null
          company?: string | null
          company_name?: string | null
          corpdev_intent?: string | null
          created_at?: string
          deal_intent?: string | null
          deal_size_band?: string | null
          deal_structure_preference?: string | null
          deleted_at?: string | null
          deploying_capital_now?: string | null
          deployment_timing?: string | null
          discretion_type?: string | null
          email?: string
          email_verified?: boolean
          equity_source?: Json | null
          estimated_revenue?: string | null
          exclusions?: Json | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          financing_plan?: Json | null
          first_name?: string
          flex_sub2m_ebitda?: boolean | null
          flex_subxm_ebitda?: boolean | null
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          geographic_focus?: Json | null
          id?: string
          ideal_target?: string | null
          ideal_target_description?: string | null
          include_keywords?: Json | null
          industry_expertise?: Json | null
          integration_plan?: Json | null
          investment_size?: Json | null
          is_admin?: boolean | null
          is_funded?: string | null
          job_title?: string | null
          last_name?: string
          linkedin_profile?: string
          mandate_blurb?: string | null
          max_equity_today_band?: string | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          needs_loan?: string | null
          on_behalf_of_buyer?: string | null
          onboarding_completed?: boolean | null
          operating_company_targets?: Json | null
          owner_intent?: string | null
          owner_timeline?: string | null
          owning_business_unit?: string | null
          permanent_capital?: boolean | null
          phone_number?: string | null
          portfolio_company_addon?: string | null
          revenue_range_max?: string | null
          revenue_range_min?: string | null
          search_stage?: string | null
          search_type?: string | null
          specific_business_search?: string | null
          target_company_size?: string | null
          target_deal_size_max?: number | null
          target_deal_size_min?: number | null
          target_locations?: Json | null
          updated_at?: string
          uses_bank_finance?: string | null
          website?: string
        }
        Relationships: []
      }
      registration_funnel: {
        Row: {
          completed_at: string | null
          created_at: string | null
          drop_off_reason: string | null
          dropped_off: boolean | null
          email: string | null
          form_data: Json | null
          id: string
          session_id: string | null
          step_name: string
          step_order: number
          time_spent: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          drop_off_reason?: string | null
          dropped_off?: boolean | null
          email?: string | null
          form_data?: Json | null
          id?: string
          session_id?: string | null
          step_name: string
          step_order: number
          time_spent?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          drop_off_reason?: string | null
          dropped_off?: boolean | null
          email?: string | null
          form_data?: Json | null
          id?: string
          session_id?: string | null
          step_name?: string
          step_order?: number
          time_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_funnel_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_analytics: {
        Row: {
          created_at: string | null
          filters_applied: Json | null
          id: string
          no_results: boolean | null
          position_clicked: number | null
          refined_search: boolean | null
          results_clicked: number | null
          results_count: number | null
          search_query: string
          session_id: string | null
          time_to_click: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters_applied?: Json | null
          id?: string
          no_results?: boolean | null
          position_clicked?: number | null
          refined_search?: boolean | null
          results_clicked?: number | null
          results_count?: number | null
          search_query: string
          session_id?: string | null
          time_to_click?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters_applied?: Json | null
          id?: string
          no_results?: boolean | null
          position_clicked?: number | null
          refined_search?: boolean | null
          results_clicked?: number | null
          results_count?: number | null
          search_query?: string
          session_id?: string | null
          time_to_click?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      similar_deal_alerts: {
        Row: {
          active: boolean
          categories: string[]
          created_at: string
          id: string
          locations: string[]
          revenue_max: number | null
          revenue_min: number | null
          source_listing_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          categories?: string[]
          created_at?: string
          id?: string
          locations?: string[]
          revenue_max?: number | null
          revenue_min?: number | null
          source_listing_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          categories?: string[]
          created_at?: string
          id?: string
          locations?: string[]
          revenue_max?: number | null
          revenue_min?: number | null
          source_listing_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "similar_deal_alerts_source_listing_id_fkey"
            columns: ["source_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similar_deal_alerts_source_listing_id_fkey"
            columns: ["source_listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similar_deal_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string | null
          element_class: string | null
          element_id: string | null
          event_action: string
          event_category: string
          event_label: string | null
          event_type: string
          event_value: number | null
          id: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string | null
          element_class?: string | null
          element_id?: string | null
          event_action: string
          event_category: string
          event_label?: string | null
          event_type: string
          event_value?: number | null
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string | null
          element_class?: string | null
          element_id?: string | null
          event_action?: string
          event_category?: string
          event_label?: string | null
          event_type?: string
          event_value?: number | null
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      user_initial_session: {
        Row: {
          browser: string | null
          browser_type: string | null
          created_at: string | null
          device_type: string | null
          first_seen_at: string | null
          full_referrer: string | null
          id: string
          landing_page: string | null
          landing_page_query: string | null
          location: Json | null
          marketing_channel: string | null
          platform: string | null
          referrer: string | null
          session_id: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          browser?: string | null
          browser_type?: string | null
          created_at?: string | null
          device_type?: string | null
          first_seen_at?: string | null
          full_referrer?: string | null
          id?: string
          landing_page?: string | null
          landing_page_query?: string | null
          location?: Json | null
          marketing_channel?: string | null
          platform?: string | null
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          browser?: string | null
          browser_type?: string | null
          created_at?: string | null
          device_type?: string | null
          first_seen_at?: string | null
          full_referrer?: string | null
          id?: string
          landing_page?: string | null
          landing_page_query?: string | null
          location?: Json | null
          marketing_channel?: string | null
          platform?: string | null
          referrer?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          connection_request_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          connection_request_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          connection_request_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_connection_request_id_fkey"
            columns: ["connection_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          os: string | null
          referrer: string | null
          session_id: string
          started_at: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          os?: string | null
          referrer?: string | null
          session_id: string
          started_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          os?: string | null
          referrer?: string | null
          session_id?: string
          started_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      unmapped_primary_owners: {
        Row: {
          created_at: string | null
          id: string | null
          internal_company_name: string | null
          internal_primary_owner: string | null
          migration_status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          internal_company_name?: string | null
          internal_primary_owner?: string | null
          migration_status?: never
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          internal_company_name?: string | null
          internal_primary_owner?: string | null
          migration_status?: never
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_connection_request_decider: {
        Args: {
          p_admin_id: string
          p_decision: string
          p_decision_at?: string
          p_request_id: string
        }
        Returns: boolean
      }
      calculate_buyer_priority_score: {
        Args: { buyer_type_param: string }
        Returns: number
      }
      calculate_deal_buyer_priority: {
        Args: { deal_row: Database["public"]["Tables"]["deals"]["Row"] }
        Returns: number
      }
      calculate_engagement_score: {
        Args: {
          p_connections_requested: number
          p_listings_saved: number
          p_listings_viewed: number
          p_total_session_time: number
        }
        Returns: number
      }
      change_user_role: {
        Args: {
          change_reason?: string
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: boolean
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      convert_inbound_lead_to_request: {
        Args: { p_lead_id: string; p_listing_id: string }
        Returns: string
      }
      create_password_reset_token: {
        Args: { user_email: string }
        Returns: string
      }
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      demote_admin_user: { Args: { target_user_id: string }; Returns: boolean }
      enhanced_merge_or_create_connection_request: {
        Args: {
          p_lead_company?: string
          p_lead_email?: string
          p_lead_name?: string
          p_lead_phone?: string
          p_lead_role?: string
          p_listing_id: string
          p_user_message: string
        }
        Returns: Json
      }
      extract_domain: { Args: { input_text: string }; Returns: string }
      generate_deal_identifier: { Args: never; Returns: string }
      get_all_user_roles: {
        Args: never
        Returns: {
          granted_at: string
          granted_by: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_connection_request_conflicts: {
        Args: never
        Returns: {
          conflict_details: Json
          conflict_type: string
          listing_title: string
          needs_review: boolean
          request_id: string
          user_email: string
        }[]
      }
      get_deals_with_details: {
        Args: never
        Returns: {
          assigned_to: string
          buyer_company: string
          buyer_connection_count: number
          buyer_email: string
          buyer_id: string
          buyer_name: string
          buyer_phone: string
          buyer_type: string
          company_deal_count: number
          completed_tasks: number
          connection_request_id: string
          contact_company: string
          contact_email: string
          contact_name: string
          contact_phone: string
          contact_role: string
          deal_buyer_priority_score: number
          deal_created_at: string
          deal_description: string
          deal_expected_close_date: string
          deal_followed_up: boolean
          deal_followed_up_at: string
          deal_followed_up_by: string
          deal_id: string
          deal_metadata: Json
          deal_negative_followed_up: boolean
          deal_negative_followed_up_at: string
          deal_negative_followed_up_by: string
          deal_priority: string
          deal_probability: number
          deal_source: string
          deal_stage_entered_at: string
          deal_title: string
          deal_updated_at: string
          deal_value: number
          fee_agreement_status: string
          last_activity_at: string
          last_contact_at: string
          listing_category: string
          listing_deal_count: number
          listing_ebitda: number
          listing_id: string
          listing_location: string
          listing_real_company_name: string
          listing_revenue: number
          listing_title: string
          nda_status: string
          pending_tasks: number
          stage_color: string
          stage_id: string
          stage_name: string
          stage_position: number
          total_activities: number
          total_tasks: number
        }[]
      }
      get_feedback_analytics: {
        Args: { days_back?: number }
        Returns: {
          avg_response_time_hours: number
          category_breakdown: Json
          daily_trends: Json
          priority_breakdown: Json
          satisfaction_avg: number
          top_users: Json
          total_feedback: number
          unread_count: number
        }[]
      }
      get_latest_profile_snapshot: {
        Args: { p_profile_id: string }
        Returns: {
          raw_business_categories: Json
          raw_payload: Json
          raw_target_locations: Json
        }[]
      }
      get_or_create_firm: {
        Args: { p_company_name: string; p_email?: string; p_website?: string }
        Returns: string
      }
      get_permission_audit_log: {
        Args: { filter_user_id?: string; limit_count?: number }
        Returns: {
          changed_by: string
          changer_email: string
          changer_name: string
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"]
          reason: string
          target_email: string
          target_name: string
          target_user_id: string
        }[]
      }
      get_profiles_with_history: {
        Args: never
        Returns: {
          business_categories_current: Json
          business_categories_dedup: Json
          buyer_type: string
          email: string
          id: string
          raw_business_categories: Json
          raw_target_locations: Json
          snapshot_created_at: string
          snapshot_type: string
          target_locations_current: Json
          target_locations_dedup: Json
        }[]
      }
      get_simple_marketplace_analytics: {
        Args: { days_back?: number }
        Returns: {
          active_sessions: number
          new_users: number
          pending_connections: number
          session_count: number
          total_listings: number
          total_page_views: number
          total_users: number
        }[]
      }
      get_stage_deal_count: { Args: { stage_uuid: string }; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      log_fee_agreement_email: {
        Args: {
          admin_notes?: string
          recipient_email: string
          target_user_id: string
        }
        Returns: boolean
      }
      log_nda_email: {
        Args: {
          admin_notes?: string
          recipient_email: string
          target_user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: { event_type: string; metadata?: Json; user_id?: string }
        Returns: undefined
      }
      match_deal_alerts_with_listing: {
        Args: { listing_data: Json }
        Returns: {
          alert_frequency: string
          alert_id: string
          alert_name: string
          user_email: string
          user_id: string
        }[]
      }
      merge_or_create_connection_request: {
        Args: {
          p_lead_company?: string
          p_lead_email?: string
          p_lead_name?: string
          p_lead_phone?: string
          p_lead_role?: string
          p_listing_id: string
          p_user_message: string
        }
        Returns: string
      }
      move_deal_stage: {
        Args: { deal_id: string; new_stage_id: string }
        Returns: boolean
      }
      move_deal_stage_with_ownership: {
        Args: {
          p_current_admin_id: string
          p_deal_id: string
          p_new_stage_id: string
        }
        Returns: Json
      }
      normalize_company_name: {
        Args: { company_name: string }
        Returns: string
      }
      preview_profile_data_restoration: {
        Args: never
        Returns: {
          current_categories: Json
          current_locations: Json
          email: string
          issue_type: string
          profile_id: string
          raw_categories: Json
          raw_locations: Json
          restoration_needed: string
        }[]
      }
      promote_user_to_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      refresh_analytics_views: { Args: never; Returns: undefined }
      restore_deal: { Args: { deal_id: string }; Returns: boolean }
      restore_profile_data_automated: {
        Args: never
        Returns: {
          details: string
          new_value: Json
          old_value: Json
          profile_id: string
          restoration_type: string
        }[]
      }
      soft_delete_deal: {
        Args: { deal_id: string; deletion_reason?: string }
        Returns: boolean
      }
      soft_delete_listing: { Args: { listing_id: string }; Returns: boolean }
      soft_delete_profile: { Args: { profile_id: string }; Returns: boolean }
      update_connection_request_followup: {
        Args: {
          admin_notes?: string
          is_followed_up: boolean
          request_id: string
        }
        Returns: boolean
      }
      update_connection_request_negative_followup: {
        Args: {
          admin_notes?: string
          is_followed_up: boolean
          request_id: string
        }
        Returns: boolean
      }
      update_connection_request_notes: {
        Args: { notes: string; request_id: string }
        Returns: boolean
      }
      update_connection_request_status: {
        Args: { admin_notes?: string; new_status: string; request_id: string }
        Returns: boolean
      }
      update_connection_request_status_simple: {
        Args: { new_status: string; request_id: string }
        Returns: boolean
      }
      update_connection_request_status_with_notes: {
        Args: {
          decision_notes?: string
          new_status: string
          request_id: string
        }
        Returns: boolean
      }
      update_daily_metrics: {
        Args: { target_date?: string }
        Returns: undefined
      }
      update_deal_owner: {
        Args: { p_actor_id?: string; p_assigned_to: string; p_deal_id: string }
        Returns: Json
      }
      update_engagement_scores: { Args: never; Returns: undefined }
      update_fee_agreement_email_status: {
        Args: { admin_notes?: string; is_sent: boolean; target_user_id: string }
        Returns: boolean
      }
      update_fee_agreement_firm_status:
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_by_name?: string
              p_signed_by_user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_at?: string
              p_signed_by_user_id?: string
            }
            Returns: boolean
          }
      update_fee_agreement_firm_status_with_notes: {
        Args: {
          p_admin_notes?: string
          p_firm_id: string
          p_is_signed: boolean
          p_signed_by_name?: string
          p_signed_by_user_id?: string
        }
        Returns: boolean
      }
      update_fee_agreement_status: {
        Args: {
          admin_notes?: string
          is_signed: boolean
          target_user_id: string
        }
        Returns: boolean
      }
      update_lead_fee_agreement_email_status:
        | { Args: { p_request_id: string; p_value: boolean }; Returns: boolean }
        | {
            Args: { admin_notes?: string; is_sent: boolean; request_id: string }
            Returns: boolean
          }
      update_lead_fee_agreement_status:
        | {
            Args: { p_request_id: string; p_value: boolean }
            Returns: undefined
          }
        | {
            Args: {
              admin_notes?: string
              is_signed: boolean
              request_id: string
            }
            Returns: boolean
          }
      update_lead_nda_email_status:
        | { Args: { p_request_id: string; p_value: boolean }; Returns: boolean }
        | {
            Args: { admin_notes?: string; is_sent: boolean; request_id: string }
            Returns: boolean
          }
      update_lead_nda_status:
        | {
            Args: { p_request_id: string; p_value: boolean }
            Returns: undefined
          }
        | {
            Args: {
              admin_notes?: string
              is_signed: boolean
              request_id: string
            }
            Returns: boolean
          }
      update_nda_email_status: {
        Args: { admin_notes?: string; is_sent: boolean; target_user_id: string }
        Returns: boolean
      }
      update_nda_firm_status:
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_by_name?: string
              p_signed_by_user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_at?: string
              p_signed_by_user_id?: string
            }
            Returns: boolean
          }
      update_nda_firm_status_with_notes: {
        Args: {
          p_admin_notes?: string
          p_firm_id: string
          p_is_signed: boolean
          p_signed_by_name?: string
          p_signed_by_user_id?: string
        }
        Returns: boolean
      }
      update_nda_status: {
        Args: {
          admin_notes?: string
          is_signed: boolean
          target_user_id: string
        }
        Returns: boolean
      }
      validate_reset_token: { Args: { token_value: string }; Returns: string }
      verify_production_readiness: {
        Args: never
        Returns: {
          check_name: string
          details: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "moderator", "user"],
    },
  },
} as const
