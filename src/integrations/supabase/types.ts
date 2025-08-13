export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          admin_id: string
          created_at: string | null
          feedback_id: string
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          title: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          feedback_id: string
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          title: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          feedback_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_messages"
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
      connection_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          decision_at: string | null
          followed_up: boolean | null
          followed_up_at: string | null
          followed_up_by: string | null
          id: string
          listing_id: string
          status: string
          updated_at: string
          user_id: string
          user_message: string | null
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          decision_at?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          listing_id: string
          status?: string
          updated_at?: string
          user_id: string
          user_message?: string | null
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          decision_at?: string | null
          followed_up?: boolean | null
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          listing_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "listing_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
          categories: string[] | null
          category: string
          created_at: string
          custom_sections: Json | null
          customer_concentration: number | null
          deal_identifier: string | null
          deleted_at: string | null
          description: string
          description_html: string | null
          description_json: Json | null
          ebitda: number
          files: string[] | null
          growth_drivers: Json | null
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
          owner_notes: string | null
          ownership_structure: string | null
          revenue: number
          revenue_model_breakdown: Json | null
          seller_involvement_preference: string | null
          seller_motivation: string | null
          status: string
          tags: string[] | null
          timeline_preference: string | null
          title: string
          transaction_preferences: Json | null
          updated_at: string
        }
        Insert: {
          categories?: string[] | null
          category: string
          created_at?: string
          custom_sections?: Json | null
          customer_concentration?: number | null
          deal_identifier?: string | null
          deleted_at?: string | null
          description: string
          description_html?: string | null
          description_json?: Json | null
          ebitda: number
          files?: string[] | null
          growth_drivers?: Json | null
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
          owner_notes?: string | null
          ownership_structure?: string | null
          revenue: number
          revenue_model_breakdown?: Json | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          status?: string
          tags?: string[] | null
          timeline_preference?: string | null
          title: string
          transaction_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          categories?: string[] | null
          category?: string
          created_at?: string
          custom_sections?: Json | null
          customer_concentration?: number | null
          deal_identifier?: string | null
          deleted_at?: string | null
          description?: string
          description_html?: string | null
          description_json?: Json | null
          ebitda?: number
          files?: string[] | null
          growth_drivers?: Json | null
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
          owner_notes?: string | null
          ownership_structure?: string | null
          revenue?: number
          revenue_model_breakdown?: Json | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          status?: string
          tags?: string[] | null
          timeline_preference?: string | null
          title?: string
          transaction_preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      nda_logs: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: string | null
          admin_name: string | null
          created_at: string
          email_sent_to: string | null
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
          id?: string
          metadata?: Json | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          approval_status: string
          aum: string | null
          bio: string | null
          business_categories: Json | null
          buyer_type: string | null
          company: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string
          email_verified: boolean
          estimated_revenue: string | null
          fee_agreement_email_sent: boolean | null
          fee_agreement_email_sent_at: string | null
          fee_agreement_signed: boolean | null
          fee_agreement_signed_at: string | null
          first_name: string
          fund_size: string | null
          funded_by: string | null
          funding_source: string | null
          id: string
          ideal_target: string | null
          ideal_target_description: string | null
          investment_size: string | null
          is_admin: boolean | null
          is_funded: string | null
          last_name: string
          linkedin_profile: string | null
          nda_email_sent: boolean | null
          nda_email_sent_at: string | null
          nda_signed: boolean | null
          nda_signed_at: string | null
          needs_loan: string | null
          onboarding_completed: boolean | null
          phone_number: string | null
          revenue_range_max: number | null
          revenue_range_min: number | null
          specific_business_search: string | null
          target_company_size: string | null
          target_locations: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          approval_status?: string
          aum?: string | null
          bio?: string | null
          business_categories?: Json | null
          buyer_type?: string | null
          company?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          email_verified?: boolean
          estimated_revenue?: string | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          first_name: string
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          id: string
          ideal_target?: string | null
          ideal_target_description?: string | null
          investment_size?: string | null
          is_admin?: boolean | null
          is_funded?: string | null
          last_name: string
          linkedin_profile?: string | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          needs_loan?: string | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          revenue_range_max?: number | null
          revenue_range_min?: number | null
          specific_business_search?: string | null
          target_company_size?: string | null
          target_locations?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          approval_status?: string
          aum?: string | null
          bio?: string | null
          business_categories?: Json | null
          buyer_type?: string | null
          company?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          email_verified?: boolean
          estimated_revenue?: string | null
          fee_agreement_email_sent?: boolean | null
          fee_agreement_email_sent_at?: string | null
          fee_agreement_signed?: boolean | null
          fee_agreement_signed_at?: string | null
          first_name?: string
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          id?: string
          ideal_target?: string | null
          ideal_target_description?: string | null
          investment_size?: string | null
          is_admin?: boolean | null
          is_funded?: string | null
          last_name?: string
          linkedin_profile?: string | null
          nda_email_sent?: boolean | null
          nda_email_sent_at?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          needs_loan?: string | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          revenue_range_max?: number | null
          revenue_range_min?: number | null
          specific_business_search?: string | null
          target_company_size?: string | null
          target_locations?: Json | null
          updated_at?: string
          website?: string | null
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
          ip_address: unknown | null
          is_active: boolean | null
          os: string | null
          referrer: string | null
          session_id: string
          started_at: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          os?: string | null
          referrer?: string | null
          session_id: string
          started_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          os?: string | null
          referrer?: string | null
          session_id?: string
          started_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_engagement_score: {
        Args: {
          p_listings_viewed: number
          p_listings_saved: number
          p_connections_requested: number
          p_total_session_time: number
        }
        Returns: number
      }
      create_password_reset_token: {
        Args: { user_email: string }
        Returns: string
      }
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      demote_admin_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      generate_deal_identifier: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_feedback_analytics: {
        Args: { days_back?: number }
        Returns: {
          total_feedback: number
          unread_count: number
          avg_response_time_hours: number
          satisfaction_avg: number
          category_breakdown: Json
          priority_breakdown: Json
          daily_trends: Json
          top_users: Json
        }[]
      }
      get_simple_marketplace_analytics: {
        Args: { days_back?: number }
        Returns: {
          total_users: number
          new_users: number
          active_sessions: number
          total_page_views: number
          total_listings: number
          pending_connections: number
          session_count: number
        }[]
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      log_fee_agreement_email: {
        Args: {
          target_user_id: string
          recipient_email: string
          admin_notes?: string
        }
        Returns: boolean
      }
      log_nda_email: {
        Args: {
          target_user_id: string
          recipient_email: string
          admin_notes?: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: { event_type: string; user_id?: string; metadata?: Json }
        Returns: undefined
      }
      match_deal_alerts_with_listing: {
        Args: { listing_data: Json }
        Returns: {
          alert_id: string
          user_id: string
          user_email: string
          alert_name: string
          alert_frequency: string
        }[]
      }
      promote_user_to_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      refresh_analytics_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      soft_delete_listing: {
        Args: { listing_id: string }
        Returns: boolean
      }
      soft_delete_profile: {
        Args: { profile_id: string }
        Returns: boolean
      }
      update_connection_request_followup: {
        Args: {
          request_id: string
          is_followed_up: boolean
          admin_notes?: string
        }
        Returns: boolean
      }
      update_daily_metrics: {
        Args: { target_date?: string }
        Returns: undefined
      }
      update_engagement_scores: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_fee_agreement_email_status: {
        Args: { target_user_id: string; is_sent: boolean; admin_notes?: string }
        Returns: boolean
      }
      update_fee_agreement_status: {
        Args: {
          target_user_id: string
          is_signed: boolean
          admin_notes?: string
        }
        Returns: boolean
      }
      update_nda_email_status: {
        Args: { target_user_id: string; is_sent: boolean; admin_notes?: string }
        Returns: boolean
      }
      update_nda_status: {
        Args: {
          target_user_id: string
          is_signed: boolean
          admin_notes?: string
        }
        Returns: boolean
      }
      validate_reset_token: {
        Args: { token_value: string }
        Returns: string
      }
      verify_production_readiness: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
