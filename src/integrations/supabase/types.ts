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
      admin_owner_leads_views: {
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_delivery_logs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      buyer_contacts: {
        Row: {
          buyer_id: string
          company_type: string | null
          created_at: string
          email: string | null
          email_confidence: string | null
          fee_agreement_status: string | null
          id: string
          is_deal_team: boolean | null
          is_primary_contact: boolean | null
          last_contacted_date: string | null
          linkedin_url: string | null
          name: string
          phone: string | null
          priority_level: number | null
          role_category: string | null
          salesforce_id: string | null
          source: string | null
          source_url: string | null
          title: string | null
        }
        Insert: {
          buyer_id: string
          company_type?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          fee_agreement_status?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          last_contacted_date?: string | null
          linkedin_url?: string | null
          name: string
          phone?: string | null
          priority_level?: number | null
          role_category?: string | null
          salesforce_id?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
        }
        Update: {
          buyer_id?: string
          company_type?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          fee_agreement_status?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          last_contacted_date?: string | null
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          priority_level?: number | null
          role_category?: string | null
          salesforce_id?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      buyer_deal_scores: {
        Row: {
          acquisition_score: number | null
          business_model_score: number | null
          buyer_id: string
          composite_score: number | null
          data_completeness: string | null
          deal_id: string
          fit_reasoning: string | null
          geography_score: number | null
          hidden_from_deal: boolean | null
          human_override_score: number | null
          id: string
          interested: boolean | null
          interested_at: string | null
          pass_category: string | null
          pass_notes: string | null
          pass_reason: string | null
          passed_at: string | null
          passed_on_deal: boolean | null
          portfolio_score: number | null
          rejected_at: string | null
          rejection_category: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          scored_at: string
          selected_for_outreach: boolean | null
          service_score: number | null
          thesis_bonus: number | null
        }
        Insert: {
          acquisition_score?: number | null
          business_model_score?: number | null
          buyer_id: string
          composite_score?: number | null
          data_completeness?: string | null
          deal_id: string
          fit_reasoning?: string | null
          geography_score?: number | null
          hidden_from_deal?: boolean | null
          human_override_score?: number | null
          id?: string
          interested?: boolean | null
          interested_at?: string | null
          pass_category?: string | null
          pass_notes?: string | null
          pass_reason?: string | null
          passed_at?: string | null
          passed_on_deal?: boolean | null
          portfolio_score?: number | null
          rejected_at?: string | null
          rejection_category?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          scored_at?: string
          selected_for_outreach?: boolean | null
          service_score?: number | null
          thesis_bonus?: number | null
        }
        Update: {
          acquisition_score?: number | null
          business_model_score?: number | null
          buyer_id?: string
          composite_score?: number | null
          data_completeness?: string | null
          deal_id?: string
          fit_reasoning?: string | null
          geography_score?: number | null
          hidden_from_deal?: boolean | null
          human_override_score?: number | null
          id?: string
          interested?: boolean | null
          interested_at?: string | null
          pass_category?: string | null
          pass_notes?: string | null
          pass_reason?: string | null
          passed_at?: string | null
          passed_on_deal?: boolean | null
          portfolio_score?: number | null
          rejected_at?: string | null
          rejection_category?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          scored_at?: string
          selected_for_outreach?: boolean | null
          service_score?: number | null
          thesis_bonus?: number | null
        }
        Relationships: []
      }
      buyer_learning_history: {
        Row: {
          action: string
          action_by: string | null
          buyer_id: string
          composite_score: number | null
          created_at: string | null
          geography_score: number | null
          id: string
          listing_id: string
          owner_goals_score: number | null
          pass_category: string | null
          pass_reason: string | null
          score_id: string | null
          service_score: number | null
          size_score: number | null
          universe_id: string | null
        }
        Insert: {
          action: string
          action_by?: string | null
          buyer_id: string
          composite_score?: number | null
          created_at?: string | null
          geography_score?: number | null
          id?: string
          listing_id: string
          owner_goals_score?: number | null
          pass_category?: string | null
          pass_reason?: string | null
          score_id?: string | null
          service_score?: number | null
          size_score?: number | null
          universe_id?: string | null
        }
        Update: {
          action?: string
          action_by?: string | null
          buyer_id?: string
          composite_score?: number | null
          created_at?: string | null
          geography_score?: number | null
          id?: string
          listing_id?: string
          owner_goals_score?: number | null
          pass_category?: string | null
          pass_reason?: string | null
          score_id?: string | null
          service_score?: number | null
          size_score?: number | null
          universe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_learning_history_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "remarketing_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_learning_history_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_transcripts: {
        Row: {
          buyer_id: string
          created_at: string | null
          created_by: string | null
          extracted_data: Json | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          processed_at: string | null
          source: string | null
          transcript_text: string
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          source?: string | null
          transcript_text: string
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          processed_at?: string | null
          source?: string | null
          transcript_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_transcripts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          acquisition_appetite: string | null
          acquisition_frequency: string | null
          acquisition_geography: string[] | null
          acquisition_timeline: string | null
          addon_only: boolean | null
          business_model: string | null
          business_model_prefs: string | null
          business_summary: string | null
          buyer_linkedin: string | null
          call_history: Json | null
          created_at: string
          data_last_updated: string
          deal_breakers: string[] | null
          ebitda_sweet_spot: number | null
          extraction_evidence: Json | null
          extraction_sources: Json | null
          fee_agreement_status: string | null
          geo_preferences: Json | null
          geographic_exclusions: string[] | null
          geographic_footprint: string[] | null
          has_fee_agreement: boolean | null
          hq_city: string | null
          hq_country: string | null
          hq_region: string | null
          hq_state: string | null
          id: string
          industry_exclusions: string[] | null
          industry_vertical: string | null
          key_quotes: string[] | null
          last_acquisition_date: string | null
          last_call_date: string | null
          max_ebitda: number | null
          max_revenue: number | null
          min_ebitda: number | null
          min_revenue: number | null
          num_platforms: number | null
          operating_locations: Json | null
          other_office_locations: string[] | null
          pe_firm_linkedin: string | null
          pe_firm_name: string
          pe_firm_website: string | null
          platform_company_name: string | null
          platform_only: boolean | null
          platform_website: string | null
          portfolio_companies: string[] | null
          preferred_ebitda: number | null
          recent_acquisitions: Json | null
          revenue_sweet_spot: number | null
          service_mix_prefs: string | null
          service_regions: string[] | null
          services_offered: string | null
          specialized_focus: string | null
          strategic_priorities: string | null
          target_geographies: string[] | null
          target_industries: string[] | null
          target_services: string[] | null
          thesis_confidence: string | null
          thesis_summary: string | null
          total_acquisitions: number | null
          tracker_id: string
        }
        Insert: {
          acquisition_appetite?: string | null
          acquisition_frequency?: string | null
          acquisition_geography?: string[] | null
          acquisition_timeline?: string | null
          addon_only?: boolean | null
          business_model?: string | null
          business_model_prefs?: string | null
          business_summary?: string | null
          buyer_linkedin?: string | null
          call_history?: Json | null
          created_at?: string
          data_last_updated?: string
          deal_breakers?: string[] | null
          ebitda_sweet_spot?: number | null
          extraction_evidence?: Json | null
          extraction_sources?: Json | null
          fee_agreement_status?: string | null
          geo_preferences?: Json | null
          geographic_exclusions?: string[] | null
          geographic_footprint?: string[] | null
          has_fee_agreement?: boolean | null
          hq_city?: string | null
          hq_country?: string | null
          hq_region?: string | null
          hq_state?: string | null
          id?: string
          industry_exclusions?: string[] | null
          industry_vertical?: string | null
          key_quotes?: string[] | null
          last_acquisition_date?: string | null
          last_call_date?: string | null
          max_ebitda?: number | null
          max_revenue?: number | null
          min_ebitda?: number | null
          min_revenue?: number | null
          num_platforms?: number | null
          operating_locations?: Json | null
          other_office_locations?: string[] | null
          pe_firm_linkedin?: string | null
          pe_firm_name: string
          pe_firm_website?: string | null
          platform_company_name?: string | null
          platform_only?: boolean | null
          platform_website?: string | null
          portfolio_companies?: string[] | null
          preferred_ebitda?: number | null
          recent_acquisitions?: Json | null
          revenue_sweet_spot?: number | null
          service_mix_prefs?: string | null
          service_regions?: string[] | null
          services_offered?: string | null
          specialized_focus?: string | null
          strategic_priorities?: string | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_services?: string[] | null
          thesis_confidence?: string | null
          thesis_summary?: string | null
          total_acquisitions?: number | null
          tracker_id: string
        }
        Update: {
          acquisition_appetite?: string | null
          acquisition_frequency?: string | null
          acquisition_geography?: string[] | null
          acquisition_timeline?: string | null
          addon_only?: boolean | null
          business_model?: string | null
          business_model_prefs?: string | null
          business_summary?: string | null
          buyer_linkedin?: string | null
          call_history?: Json | null
          created_at?: string
          data_last_updated?: string
          deal_breakers?: string[] | null
          ebitda_sweet_spot?: number | null
          extraction_evidence?: Json | null
          extraction_sources?: Json | null
          fee_agreement_status?: string | null
          geo_preferences?: Json | null
          geographic_exclusions?: string[] | null
          geographic_footprint?: string[] | null
          has_fee_agreement?: boolean | null
          hq_city?: string | null
          hq_country?: string | null
          hq_region?: string | null
          hq_state?: string | null
          id?: string
          industry_exclusions?: string[] | null
          industry_vertical?: string | null
          key_quotes?: string[] | null
          last_acquisition_date?: string | null
          last_call_date?: string | null
          max_ebitda?: number | null
          max_revenue?: number | null
          min_ebitda?: number | null
          min_revenue?: number | null
          num_platforms?: number | null
          operating_locations?: Json | null
          other_office_locations?: string[] | null
          pe_firm_linkedin?: string | null
          pe_firm_name?: string
          pe_firm_website?: string | null
          platform_company_name?: string | null
          platform_only?: boolean | null
          platform_website?: string | null
          portfolio_companies?: string[] | null
          preferred_ebitda?: number | null
          recent_acquisitions?: Json | null
          revenue_sweet_spot?: number | null
          service_mix_prefs?: string | null
          service_regions?: string[] | null
          services_offered?: string | null
          specialized_focus?: string | null
          strategic_priorities?: string | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_services?: string[] | null
          thesis_confidence?: string | null
          thesis_summary?: string | null
          total_acquisitions?: number | null
          tracker_id?: string
        }
        Relationships: []
      }
      call_intelligence: {
        Row: {
          buyer_id: string | null
          call_date: string | null
          call_summary: string | null
          call_type: string
          created_at: string | null
          deal_id: string | null
          extracted_data: Json | null
          extraction_version: string | null
          follow_up_questions: string[] | null
          id: string
          key_takeaways: string[] | null
          processed_at: string | null
          transcript_url: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          call_date?: string | null
          call_summary?: string | null
          call_type?: string
          created_at?: string | null
          deal_id?: string | null
          extracted_data?: Json | null
          extraction_version?: string | null
          follow_up_questions?: string[] | null
          id?: string
          key_takeaways?: string[] | null
          processed_at?: string | null
          transcript_url?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          call_date?: string | null
          call_summary?: string | null
          call_type?: string
          created_at?: string | null
          deal_id?: string | null
          extracted_data?: Json | null
          extraction_version?: string | null
          follow_up_questions?: string[] | null
          id?: string
          key_takeaways?: string[] | null
          processed_at?: string | null
          transcript_url?: string | null
          updated_at?: string | null
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      cron_job_logs: {
        Row: {
          created_at: string | null
          id: string
          job_name: string
          result: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_name: string
          result?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
        }
        Relationships: []
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
          unique_visitors: number | null
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
          unique_visitors?: number | null
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
          unique_visitors?: number | null
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
      deal_ranking_history: {
        Row: {
          change_reason: string | null
          changed_by_user_id: string | null
          created_at: string | null
          id: string
          listing_id: string
          new_rank: number | null
          new_score: number | null
          old_rank: number | null
          old_score: number | null
        }
        Insert: {
          change_reason?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          listing_id: string
          new_rank?: number | null
          new_score?: number | null
          old_rank?: number | null
          old_score?: number | null
        }
        Update: {
          change_reason?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string
          new_rank?: number | null
          new_score?: number | null
          old_rank?: number | null
          old_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_ranking_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ranking_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ranking_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ranking_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ranking_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_referrals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      deal_scoring_adjustments: {
        Row: {
          adjustment_type: string
          adjustment_value: number
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          id: string
          listing_id: string
          reason: string | null
        }
        Insert: {
          adjustment_type: string
          adjustment_value?: number
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          listing_id: string
          reason?: string | null
        }
        Update: {
          adjustment_type?: string
          adjustment_value?: number
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          listing_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_scoring_adjustments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_scoring_adjustments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_scoring_adjustments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_scoring_adjustments_listing_id_fkey"
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
      deal_transcripts: {
        Row: {
          applied_at: string | null
          applied_to_deal: boolean | null
          call_date: string | null
          created_at: string | null
          created_by: string | null
          extracted_data: Json | null
          id: string
          listing_id: string
          processed_at: string | null
          source: string | null
          title: string | null
          transcript_text: string
          transcript_url: string | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_to_deal?: boolean | null
          call_date?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          id?: string
          listing_id: string
          processed_at?: string | null
          source?: string | null
          title?: string | null
          transcript_text: string
          transcript_url?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_to_deal?: boolean | null
          call_date?: string | null
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          id?: string
          listing_id?: string
          processed_at?: string | null
          source?: string | null
          title?: string | null
          transcript_text?: string
          transcript_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_transcripts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_transcripts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_transcripts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_transcripts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      enrichment_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          listing_id: string
          queued_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          listing_id: string
          queued_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          listing_id?: string
          queued_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "unmapped_primary_owners"
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
          admin_notes: string | null
          business_website: string | null
          company_name: string | null
          converted_at: string | null
          converted_by: string | null
          converted_to_request_id: string | null
          created_at: string
          duplicate_info: string | null
          email: string
          estimated_revenue_range: string | null
          firm_id: string | null
          id: string
          is_duplicate: boolean | null
          lead_type: string | null
          mapped_at: string | null
          mapped_by: string | null
          mapped_to_listing_id: string | null
          mapped_to_listing_title: string | null
          message: string | null
          name: string
          phone_number: string | null
          priority_score: number
          role: string | null
          sale_timeline: string | null
          source: string
          source_form_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          business_website?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_request_id?: string | null
          created_at?: string
          duplicate_info?: string | null
          email: string
          estimated_revenue_range?: string | null
          firm_id?: string | null
          id?: string
          is_duplicate?: boolean | null
          lead_type?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_to_listing_id?: string | null
          mapped_to_listing_title?: string | null
          message?: string | null
          name: string
          phone_number?: string | null
          priority_score?: number
          role?: string | null
          sale_timeline?: string | null
          source?: string
          source_form_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          business_website?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_request_id?: string | null
          created_at?: string
          duplicate_info?: string | null
          email?: string
          estimated_revenue_range?: string | null
          firm_id?: string | null
          id?: string
          is_duplicate?: boolean | null
          lead_type?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_to_listing_id?: string | null
          mapped_to_listing_title?: string | null
          message?: string | null
          name?: string
          phone_number?: string | null
          priority_score?: number
          role?: string | null
          sale_timeline?: string | null
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_leads_mapped_to_listing_id_fkey"
            columns: ["mapped_to_listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      industry_classifications: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          industry_name: string
          industry_tier: number | null
          is_addon_heavy: boolean | null
          is_rollup_strategy: boolean | null
          keywords: string[] | null
          pe_attractiveness_notes: string | null
          recurring_revenue_typical: boolean | null
          tier_name: string | null
          typical_ebitda_multiple_range: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry_name: string
          industry_tier?: number | null
          is_addon_heavy?: boolean | null
          is_rollup_strategy?: boolean | null
          keywords?: string[] | null
          pe_attractiveness_notes?: string | null
          recurring_revenue_typical?: boolean | null
          tier_name?: string | null
          typical_ebitda_multiple_range?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry_name?: string
          industry_tier?: number | null
          is_addon_heavy?: boolean | null
          is_rollup_strategy?: boolean | null
          keywords?: string[] | null
          pe_attractiveness_notes?: string | null
          recurring_revenue_typical?: boolean | null
          tier_name?: string | null
          typical_ebitda_multiple_range?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      industry_trackers: {
        Row: {
          buyer_count: number | null
          color: string | null
          created_at: string | null
          deal_count: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          universe_id: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_count?: number | null
          color?: string | null
          created_at?: string | null
          deal_count?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          universe_id?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_count?: number | null
          color?: string | null
          created_at?: string | null
          deal_count?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          universe_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_trackers_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          requires_partner: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_partner?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_partner?: boolean | null
          updated_at?: string | null
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_analytics_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
          address: string | null
          address_city: string | null
          address_country: string | null
          address_state: string | null
          address_zip: string | null
          ai_description: string | null
          business_model: string | null
          calculated_rank: number | null
          categories: string[] | null
          category: string
          competitive_position: string | null
          created_at: string
          custom_metric_label: string | null
          custom_metric_subtitle: string | null
          custom_metric_value: string | null
          custom_sections: Json | null
          customer_concentration: number | null
          customer_geography: string | null
          customer_types: string | null
          deal_identifier: string | null
          deal_industry_score: number | null
          deal_motivation_score: number | null
          deal_quality_score: number | null
          deal_size_score: number | null
          deal_total_score: number | null
          deleted_at: string | null
          description: string
          description_html: string | null
          description_json: Json | null
          ebitda: number
          ebitda_confidence: string | null
          ebitda_is_inferred: boolean | null
          ebitda_metric_subtitle: string | null
          ebitda_source_quote: string | null
          enriched_at: string | null
          enrichment_error_message: string | null
          enrichment_last_attempted_at: string | null
          enrichment_last_successful_at: string | null
          enrichment_refresh_due_at: string | null
          enrichment_scheduled_at: string | null
          enrichment_status: string | null
          estimated_ebitda: number | null
          executive_summary: string | null
          external_id: string | null
          external_source: string | null
          extraction_sources: Json | null
          files: string[] | null
          final_rank: number | null
          fireflies_url: string | null
          founded_year: number | null
          full_time_employees: number | null
          general_notes: string | null
          geographic_states: string[] | null
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          growth_drivers: Json | null
          growth_trajectory: string | null
          has_management_team: boolean | null
          has_multiple_locations: boolean | null
          hero_description: string | null
          id: string
          image_url: string | null
          industry: string | null
          industry_tier: number | null
          industry_tier_name: string | null
          internal_company_name: string | null
          internal_contact_info: string | null
          internal_deal_memo_link: string | null
          internal_notes: string | null
          internal_primary_owner: string | null
          internal_salesforce_link: string | null
          investment_thesis: string | null
          is_owner_dependent: boolean | null
          is_priority_target: boolean | null
          key_quotes: string[] | null
          key_risks: Json | null
          last_ranked_at: string | null
          lead_source_id: string | null
          lead_source_notes: string | null
          linkedin_employee_count: number | null
          linkedin_employee_range: string | null
          linkedin_url: string | null
          location: string
          location_radius_requirement: string | null
          management_depth: string | null
          manual_rank_override: number | null
          market_position: Json | null
          metric_3_custom_label: string | null
          metric_3_custom_subtitle: string | null
          metric_3_custom_value: string | null
          metric_3_type: string | null
          metric_4_custom_label: string | null
          metric_4_custom_subtitle: string | null
          metric_4_custom_value: string | null
          metric_4_type: string | null
          mr_notes: string | null
          notes: string | null
          notes_analyzed_at: string | null
          number_of_locations: number | null
          owner_email: string | null
          owner_first_name: string | null
          owner_goals: string | null
          owner_last_name: string | null
          owner_notes: string | null
          owner_phone: string | null
          owner_title: string | null
          ownership_structure: string | null
          part_time_employees: number | null
          presented_by_admin_id: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_owner_id: string | null
          product_revenue_percentage: number | null
          project_revenue_percentage: number | null
          rank_locked: boolean | null
          real_estate_info: string | null
          recurring_revenue_percentage: number | null
          referral_partner_id: string | null
          revenue: number
          revenue_confidence: string | null
          revenue_is_inferred: boolean | null
          revenue_metric_subtitle: string | null
          revenue_model: string | null
          revenue_model_breakdown: Json | null
          revenue_source_quote: string | null
          revenue_trend: string | null
          seller_interest_analyzed_at: string | null
          seller_interest_confidence: string | null
          seller_interest_notes: Json | null
          seller_interest_score: number | null
          seller_involvement_preference: string | null
          seller_motivation: string | null
          service_mix: string | null
          service_revenue_percentage: number | null
          services: string[] | null
          special_requirements: string | null
          status: string
          status_label: string | null
          status_tag: string | null
          street_address: string | null
          tags: string[] | null
          team_page_employee_count: number | null
          technology_systems: string | null
          timeline_preference: string | null
          title: string
          transaction_preferences: Json | null
          updated_at: string
          visible_to_buyer_types: string[] | null
          website: string | null
        }
        Insert: {
          acquisition_type?: string | null
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_zip?: string | null
          ai_description?: string | null
          business_model?: string | null
          calculated_rank?: number | null
          categories?: string[] | null
          category: string
          competitive_position?: string | null
          created_at?: string
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          customer_geography?: string | null
          customer_types?: string | null
          deal_identifier?: string | null
          deal_industry_score?: number | null
          deal_motivation_score?: number | null
          deal_quality_score?: number | null
          deal_size_score?: number | null
          deal_total_score?: number | null
          deleted_at?: string | null
          description: string
          description_html?: string | null
          description_json?: Json | null
          ebitda: number
          ebitda_confidence?: string | null
          ebitda_is_inferred?: boolean | null
          ebitda_metric_subtitle?: string | null
          ebitda_source_quote?: string | null
          enriched_at?: string | null
          enrichment_error_message?: string | null
          enrichment_last_attempted_at?: string | null
          enrichment_last_successful_at?: string | null
          enrichment_refresh_due_at?: string | null
          enrichment_scheduled_at?: string | null
          enrichment_status?: string | null
          estimated_ebitda?: number | null
          executive_summary?: string | null
          external_id?: string | null
          external_source?: string | null
          extraction_sources?: Json | null
          files?: string[] | null
          final_rank?: number | null
          fireflies_url?: string | null
          founded_year?: number | null
          full_time_employees?: number | null
          general_notes?: string | null
          geographic_states?: string[] | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          growth_drivers?: Json | null
          growth_trajectory?: string | null
          has_management_team?: boolean | null
          has_multiple_locations?: boolean | null
          hero_description?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          industry_tier?: number | null
          industry_tier_name?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          is_owner_dependent?: boolean | null
          is_priority_target?: boolean | null
          key_quotes?: string[] | null
          key_risks?: Json | null
          last_ranked_at?: string | null
          lead_source_id?: string | null
          lead_source_notes?: string | null
          linkedin_employee_count?: number | null
          linkedin_employee_range?: string | null
          linkedin_url?: string | null
          location: string
          location_radius_requirement?: string | null
          management_depth?: string | null
          manual_rank_override?: number | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          mr_notes?: string | null
          notes?: string | null
          notes_analyzed_at?: string | null
          number_of_locations?: number | null
          owner_email?: string | null
          owner_first_name?: string | null
          owner_goals?: string | null
          owner_last_name?: string | null
          owner_notes?: string | null
          owner_phone?: string | null
          owner_title?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_owner_id?: string | null
          product_revenue_percentage?: number | null
          project_revenue_percentage?: number | null
          rank_locked?: boolean | null
          real_estate_info?: string | null
          recurring_revenue_percentage?: number | null
          referral_partner_id?: string | null
          revenue: number
          revenue_confidence?: string | null
          revenue_is_inferred?: boolean | null
          revenue_metric_subtitle?: string | null
          revenue_model?: string | null
          revenue_model_breakdown?: Json | null
          revenue_source_quote?: string | null
          revenue_trend?: string | null
          seller_interest_analyzed_at?: string | null
          seller_interest_confidence?: string | null
          seller_interest_notes?: Json | null
          seller_interest_score?: number | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          service_mix?: string | null
          service_revenue_percentage?: number | null
          services?: string[] | null
          special_requirements?: string | null
          status?: string
          status_label?: string | null
          status_tag?: string | null
          street_address?: string | null
          tags?: string[] | null
          team_page_employee_count?: number | null
          technology_systems?: string | null
          timeline_preference?: string | null
          title: string
          transaction_preferences?: Json | null
          updated_at?: string
          visible_to_buyer_types?: string[] | null
          website?: string | null
        }
        Update: {
          acquisition_type?: string | null
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_zip?: string | null
          ai_description?: string | null
          business_model?: string | null
          calculated_rank?: number | null
          categories?: string[] | null
          category?: string
          competitive_position?: string | null
          created_at?: string
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          customer_geography?: string | null
          customer_types?: string | null
          deal_identifier?: string | null
          deal_industry_score?: number | null
          deal_motivation_score?: number | null
          deal_quality_score?: number | null
          deal_size_score?: number | null
          deal_total_score?: number | null
          deleted_at?: string | null
          description?: string
          description_html?: string | null
          description_json?: Json | null
          ebitda?: number
          ebitda_confidence?: string | null
          ebitda_is_inferred?: boolean | null
          ebitda_metric_subtitle?: string | null
          ebitda_source_quote?: string | null
          enriched_at?: string | null
          enrichment_error_message?: string | null
          enrichment_last_attempted_at?: string | null
          enrichment_last_successful_at?: string | null
          enrichment_refresh_due_at?: string | null
          enrichment_scheduled_at?: string | null
          enrichment_status?: string | null
          estimated_ebitda?: number | null
          executive_summary?: string | null
          external_id?: string | null
          external_source?: string | null
          extraction_sources?: Json | null
          files?: string[] | null
          final_rank?: number | null
          fireflies_url?: string | null
          founded_year?: number | null
          full_time_employees?: number | null
          general_notes?: string | null
          geographic_states?: string[] | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          growth_drivers?: Json | null
          growth_trajectory?: string | null
          has_management_team?: boolean | null
          has_multiple_locations?: boolean | null
          hero_description?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          industry_tier?: number | null
          industry_tier_name?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          is_owner_dependent?: boolean | null
          is_priority_target?: boolean | null
          key_quotes?: string[] | null
          key_risks?: Json | null
          last_ranked_at?: string | null
          lead_source_id?: string | null
          lead_source_notes?: string | null
          linkedin_employee_count?: number | null
          linkedin_employee_range?: string | null
          linkedin_url?: string | null
          location?: string
          location_radius_requirement?: string | null
          management_depth?: string | null
          manual_rank_override?: number | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          mr_notes?: string | null
          notes?: string | null
          notes_analyzed_at?: string | null
          number_of_locations?: number | null
          owner_email?: string | null
          owner_first_name?: string | null
          owner_goals?: string | null
          owner_last_name?: string | null
          owner_notes?: string | null
          owner_phone?: string | null
          owner_title?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_owner_id?: string | null
          product_revenue_percentage?: number | null
          project_revenue_percentage?: number | null
          rank_locked?: boolean | null
          real_estate_info?: string | null
          recurring_revenue_percentage?: number | null
          referral_partner_id?: string | null
          revenue?: number
          revenue_confidence?: string | null
          revenue_is_inferred?: boolean | null
          revenue_metric_subtitle?: string | null
          revenue_model?: string | null
          revenue_model_breakdown?: Json | null
          revenue_source_quote?: string | null
          revenue_trend?: string | null
          seller_interest_analyzed_at?: string | null
          seller_interest_confidence?: string | null
          seller_interest_notes?: Json | null
          seller_interest_score?: number | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          service_mix?: string | null
          service_revenue_percentage?: number | null
          services?: string[] | null
          special_requirements?: string | null
          status?: string
          status_label?: string | null
          status_tag?: string | null
          street_address?: string | null
          tags?: string[] | null
          team_page_employee_count?: number | null
          technology_systems?: string | null
          timeline_preference?: string | null
          title?: string
          transaction_preferences?: Json | null
          updated_at?: string
          visible_to_buyer_types?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "listings_referral_partner_id_fkey"
            columns: ["referral_partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
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
      outreach_records: {
        Row: {
          buyer_id: string
          cim_sent_at: string | null
          cim_sent_by: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          created_by: string | null
          id: string
          last_contact_date: string | null
          listing_id: string
          meeting_notes: string | null
          meeting_scheduled_at: string | null
          nda_sent_at: string | null
          nda_sent_by: string | null
          nda_signed_at: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          outcome: string | null
          outcome_at: string | null
          outcome_notes: string | null
          priority: string | null
          score_id: string | null
          universe_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cim_sent_at?: string | null
          cim_sent_by?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_contact_date?: string | null
          listing_id: string
          meeting_notes?: string | null
          meeting_scheduled_at?: string | null
          nda_sent_at?: string | null
          nda_sent_by?: string | null
          nda_signed_at?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_notes?: string | null
          priority?: string | null
          score_id?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cim_sent_at?: string | null
          cim_sent_by?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_contact_date?: string | null
          listing_id?: string
          meeting_notes?: string | null
          meeting_scheduled_at?: string | null
          nda_sent_at?: string | null
          nda_sent_by?: string | null
          nda_signed_at?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_notes?: string | null
          priority?: string | null
          score_id?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_records_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "remarketing_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_records_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intro_notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      pe_firm_contacts: {
        Row: {
          bio_url: string | null
          buyer_id: string | null
          created_at: string
          email: string | null
          email_confidence: string | null
          id: string
          is_deal_team: boolean | null
          is_primary_contact: boolean | null
          linkedin_url: string | null
          name: string
          notes: string | null
          pe_firm_id: string | null
          phone: string | null
          priority_level: number | null
          role_category: string | null
          source: string | null
          source_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bio_url?: string | null
          buyer_id?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          pe_firm_id?: string | null
          phone?: string | null
          priority_level?: number | null
          role_category?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bio_url?: string | null
          buyer_id?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          pe_firm_id?: string | null
          phone?: string | null
          priority_level?: number | null
          role_category?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pe_firm_contacts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pe_firm_contacts_pe_firm_id_fkey"
            columns: ["pe_firm_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
        ]
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
      platform_contacts: {
        Row: {
          bio_url: string | null
          buyer_id: string | null
          created_at: string
          email: string | null
          email_confidence: string | null
          id: string
          is_deal_team: boolean | null
          is_primary_contact: boolean | null
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          platform_id: string | null
          priority_level: number | null
          role_category: string | null
          source: string | null
          source_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bio_url?: string | null
          buyer_id?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          platform_id?: string | null
          priority_level?: number | null
          role_category?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bio_url?: string | null
          buyer_id?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          platform_id?: string | null
          priority_level?: number | null
          role_category?: string | null
          source?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_contacts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_contacts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
        ]
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
          deal_sourcing_methods: Json | null
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
          first_blog_landing: string | null
          first_external_referrer: string | null
          first_name: string
          first_seen_at: string | null
          first_utm_source: string | null
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
          referral_source: string | null
          referral_source_detail: string | null
          revenue_range_max: string | null
          revenue_range_min: string | null
          search_stage: string | null
          search_type: string | null
          specific_business_search: string | null
          target_acquisition_volume: string | null
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
          deal_sourcing_methods?: Json | null
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
          first_blog_landing?: string | null
          first_external_referrer?: string | null
          first_name?: string
          first_seen_at?: string | null
          first_utm_source?: string | null
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
          referral_source?: string | null
          referral_source_detail?: string | null
          revenue_range_max?: string | null
          revenue_range_min?: string | null
          search_stage?: string | null
          search_type?: string | null
          specific_business_search?: string | null
          target_acquisition_volume?: string | null
          target_company_size?: string | null
          target_deal_size_max?: number | null
          target_deal_size_min?: number | null
          target_locations?: Json | null
          updated_at?: string
          uses_bank_finance?: string | null
          website?: string
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
          deal_sourcing_methods?: Json | null
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
          first_blog_landing?: string | null
          first_external_referrer?: string | null
          first_name?: string
          first_seen_at?: string | null
          first_utm_source?: string | null
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
          referral_source?: string | null
          referral_source_detail?: string | null
          revenue_range_max?: string | null
          revenue_range_min?: string | null
          search_stage?: string | null
          search_type?: string | null
          specific_business_search?: string | null
          target_acquisition_volume?: string | null
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
      referral_partners: {
        Row: {
          company: string | null
          created_at: string | null
          deal_count: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          deal_count?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          deal_count?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
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
      remarketing_buyer_contacts: {
        Row: {
          buyer_id: string
          company_type: string | null
          created_at: string
          email: string | null
          email_confidence: string | null
          id: string
          is_deal_team: boolean | null
          is_primary: boolean
          is_primary_contact: boolean | null
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          priority_level: number | null
          role: string | null
          role_category: string | null
          salesforce_id: string | null
          source: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          company_type?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary?: boolean
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          priority_level?: number | null
          role?: string | null
          role_category?: string | null
          salesforce_id?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          company_type?: string | null
          created_at?: string
          email?: string | null
          email_confidence?: string | null
          id?: string
          is_deal_team?: boolean | null
          is_primary?: boolean
          is_primary_contact?: boolean | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          priority_level?: number | null
          role?: string | null
          role_category?: string | null
          salesforce_id?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_buyer_contacts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_buyer_universes: {
        Row: {
          archived: boolean
          buyer_types_criteria: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          documents: Json | null
          documents_analyzed_at: string | null
          fit_criteria: string | null
          fit_criteria_buyer_types: string | null
          fit_criteria_geography: string | null
          fit_criteria_service: string | null
          fit_criteria_size: string | null
          geography_criteria: Json | null
          geography_weight: number
          id: string
          industry_template: string | null
          kpi_scoring_config: Json | null
          ma_guide_content: string | null
          ma_guide_generated_at: string | null
          ma_guide_qa_context: Json | null
          name: string
          owner_goals_weight: number
          scoring_behavior: Json | null
          service_criteria: Json | null
          service_weight: number
          size_criteria: Json | null
          size_weight: number
          target_buyer_types: Json | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          buyer_types_criteria?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          documents_analyzed_at?: string | null
          fit_criteria?: string | null
          fit_criteria_buyer_types?: string | null
          fit_criteria_geography?: string | null
          fit_criteria_service?: string | null
          fit_criteria_size?: string | null
          geography_criteria?: Json | null
          geography_weight?: number
          id?: string
          industry_template?: string | null
          kpi_scoring_config?: Json | null
          ma_guide_content?: string | null
          ma_guide_generated_at?: string | null
          ma_guide_qa_context?: Json | null
          name: string
          owner_goals_weight?: number
          scoring_behavior?: Json | null
          service_criteria?: Json | null
          service_weight?: number
          size_criteria?: Json | null
          size_weight?: number
          target_buyer_types?: Json | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          buyer_types_criteria?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          documents_analyzed_at?: string | null
          fit_criteria?: string | null
          fit_criteria_buyer_types?: string | null
          fit_criteria_geography?: string | null
          fit_criteria_service?: string | null
          fit_criteria_size?: string | null
          geography_criteria?: Json | null
          geography_weight?: number
          id?: string
          industry_template?: string | null
          kpi_scoring_config?: Json | null
          ma_guide_content?: string | null
          ma_guide_generated_at?: string | null
          ma_guide_qa_context?: Json | null
          name?: string
          owner_goals_weight?: number
          scoring_behavior?: Json | null
          service_criteria?: Json | null
          service_weight?: number
          size_criteria?: Json | null
          size_weight?: number
          target_buyer_types?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      remarketing_buyers: {
        Row: {
          acquisition_appetite: string | null
          acquisition_frequency: string | null
          acquisition_timeline: string | null
          alignment_checked_at: string | null
          alignment_reasoning: string | null
          alignment_score: number | null
          archived: boolean
          business_summary: string | null
          business_type: string | null
          buyer_linkedin: string | null
          buyer_type: string | null
          company_name: string
          company_website: string | null
          confidence_level: string | null
          contact_discovery_status: string | null
          created_at: string
          customer_geographic_reach: string | null
          customer_industries: string[] | null
          data_completeness: string | null
          data_last_updated: string | null
          deal_breakers: string[] | null
          deal_preferences: string | null
          detected_email_pattern: string | null
          ebitda_sweet_spot: number | null
          email_domain: string | null
          extraction_sources: Json | null
          fee_agreement_status: string | null
          geographic_footprint: string[] | null
          has_fee_agreement: boolean | null
          hq_city: string | null
          hq_country: string | null
          hq_region: string | null
          hq_state: string | null
          id: string
          industry_tracker_id: string | null
          industry_vertical: string | null
          investment_date: string | null
          key_quotes: string[] | null
          last_contact_discovery_at: string | null
          notes: string | null
          num_platforms: number | null
          operating_locations: string[] | null
          pe_firm_acquisitions: Json | null
          pe_firm_id: string | null
          pe_firm_linkedin: string | null
          pe_firm_name: string | null
          pe_firm_website: string | null
          platform_acquisitions: Json | null
          platform_website: string | null
          portfolio_companies: Json | null
          primary_customer_size: string | null
          recent_acquisitions: Json | null
          revenue_model: string | null
          revenue_sweet_spot: number | null
          scores_stale_since: string | null
          service_regions: string[] | null
          services_offered: string | null
          specialized_focus: string | null
          strategic_priorities: string[] | null
          target_customer_profile: string | null
          target_ebitda_max: number | null
          target_ebitda_min: number | null
          target_geographies: string[] | null
          target_industries: string[] | null
          target_revenue_max: number | null
          target_revenue_min: number | null
          target_services: string[] | null
          thesis_confidence: string | null
          thesis_summary: string | null
          total_acquisitions: number | null
          universe_id: string | null
          updated_at: string
        }
        Insert: {
          acquisition_appetite?: string | null
          acquisition_frequency?: string | null
          acquisition_timeline?: string | null
          alignment_checked_at?: string | null
          alignment_reasoning?: string | null
          alignment_score?: number | null
          archived?: boolean
          business_summary?: string | null
          business_type?: string | null
          buyer_linkedin?: string | null
          buyer_type?: string | null
          company_name: string
          company_website?: string | null
          confidence_level?: string | null
          contact_discovery_status?: string | null
          created_at?: string
          customer_geographic_reach?: string | null
          customer_industries?: string[] | null
          data_completeness?: string | null
          data_last_updated?: string | null
          deal_breakers?: string[] | null
          deal_preferences?: string | null
          detected_email_pattern?: string | null
          ebitda_sweet_spot?: number | null
          email_domain?: string | null
          extraction_sources?: Json | null
          fee_agreement_status?: string | null
          geographic_footprint?: string[] | null
          has_fee_agreement?: boolean | null
          hq_city?: string | null
          hq_country?: string | null
          hq_region?: string | null
          hq_state?: string | null
          id?: string
          industry_tracker_id?: string | null
          industry_vertical?: string | null
          investment_date?: string | null
          key_quotes?: string[] | null
          last_contact_discovery_at?: string | null
          notes?: string | null
          num_platforms?: number | null
          operating_locations?: string[] | null
          pe_firm_acquisitions?: Json | null
          pe_firm_id?: string | null
          pe_firm_linkedin?: string | null
          pe_firm_name?: string | null
          pe_firm_website?: string | null
          platform_acquisitions?: Json | null
          platform_website?: string | null
          portfolio_companies?: Json | null
          primary_customer_size?: string | null
          recent_acquisitions?: Json | null
          revenue_model?: string | null
          revenue_sweet_spot?: number | null
          scores_stale_since?: string | null
          service_regions?: string[] | null
          services_offered?: string | null
          specialized_focus?: string | null
          strategic_priorities?: string[] | null
          target_customer_profile?: string | null
          target_ebitda_max?: number | null
          target_ebitda_min?: number | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_revenue_max?: number | null
          target_revenue_min?: number | null
          target_services?: string[] | null
          thesis_confidence?: string | null
          thesis_summary?: string | null
          total_acquisitions?: number | null
          universe_id?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_appetite?: string | null
          acquisition_frequency?: string | null
          acquisition_timeline?: string | null
          alignment_checked_at?: string | null
          alignment_reasoning?: string | null
          alignment_score?: number | null
          archived?: boolean
          business_summary?: string | null
          business_type?: string | null
          buyer_linkedin?: string | null
          buyer_type?: string | null
          company_name?: string
          company_website?: string | null
          confidence_level?: string | null
          contact_discovery_status?: string | null
          created_at?: string
          customer_geographic_reach?: string | null
          customer_industries?: string[] | null
          data_completeness?: string | null
          data_last_updated?: string | null
          deal_breakers?: string[] | null
          deal_preferences?: string | null
          detected_email_pattern?: string | null
          ebitda_sweet_spot?: number | null
          email_domain?: string | null
          extraction_sources?: Json | null
          fee_agreement_status?: string | null
          geographic_footprint?: string[] | null
          has_fee_agreement?: boolean | null
          hq_city?: string | null
          hq_country?: string | null
          hq_region?: string | null
          hq_state?: string | null
          id?: string
          industry_tracker_id?: string | null
          industry_vertical?: string | null
          investment_date?: string | null
          key_quotes?: string[] | null
          last_contact_discovery_at?: string | null
          notes?: string | null
          num_platforms?: number | null
          operating_locations?: string[] | null
          pe_firm_acquisitions?: Json | null
          pe_firm_id?: string | null
          pe_firm_linkedin?: string | null
          pe_firm_name?: string | null
          pe_firm_website?: string | null
          platform_acquisitions?: Json | null
          platform_website?: string | null
          portfolio_companies?: Json | null
          primary_customer_size?: string | null
          recent_acquisitions?: Json | null
          revenue_model?: string | null
          revenue_sweet_spot?: number | null
          scores_stale_since?: string | null
          service_regions?: string[] | null
          services_offered?: string | null
          specialized_focus?: string | null
          strategic_priorities?: string[] | null
          target_customer_profile?: string | null
          target_ebitda_max?: number | null
          target_ebitda_min?: number | null
          target_geographies?: string[] | null
          target_industries?: string[] | null
          target_revenue_max?: number | null
          target_revenue_min?: number | null
          target_services?: string[] | null
          thesis_confidence?: string | null
          thesis_summary?: string | null
          total_acquisitions?: number | null
          universe_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_buyers_industry_tracker_id_fkey"
            columns: ["industry_tracker_id"]
            isOneToOne: false
            referencedRelation: "industry_trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_buyers_pe_firm_id_fkey"
            columns: ["pe_firm_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_buyers_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_outreach: {
        Row: {
          buyer_id: string
          contact_method: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          listing_id: string
          meeting_at: string | null
          notes: string | null
          response_at: string | null
          score_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          contact_method?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          listing_id: string
          meeting_at?: string | null
          notes?: string | null
          response_at?: string | null
          score_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          contact_method?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          listing_id?: string
          meeting_at?: string | null
          notes?: string | null
          response_at?: string | null
          score_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_outreach_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_outreach_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_outreach_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_outreach_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_outreach_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_outreach_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "remarketing_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_scores: {
        Row: {
          acquisition_score: number | null
          business_model_score: number | null
          buyer_id: string
          composite_score: number
          created_at: string
          data_completeness: string | null
          deal_snapshot: Json | null
          fit_reasoning: string | null
          geography_score: number | null
          hidden_from_deal: boolean | null
          human_override_score: number | null
          id: string
          last_viewed_at: string | null
          listing_id: string
          owner_goals_score: number | null
          pass_category: string | null
          pass_reason: string | null
          portfolio_score: number | null
          rejected_at: string | null
          rejection_category: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          scored_at: string | null
          scored_by: string | null
          service_score: number | null
          size_score: number | null
          status: string
          thesis_bonus: number | null
          tier: string | null
          universe_id: string | null
          updated_at: string
        }
        Insert: {
          acquisition_score?: number | null
          business_model_score?: number | null
          buyer_id: string
          composite_score?: number
          created_at?: string
          data_completeness?: string | null
          deal_snapshot?: Json | null
          fit_reasoning?: string | null
          geography_score?: number | null
          hidden_from_deal?: boolean | null
          human_override_score?: number | null
          id?: string
          last_viewed_at?: string | null
          listing_id: string
          owner_goals_score?: number | null
          pass_category?: string | null
          pass_reason?: string | null
          portfolio_score?: number | null
          rejected_at?: string | null
          rejection_category?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          scored_at?: string | null
          scored_by?: string | null
          service_score?: number | null
          size_score?: number | null
          status?: string
          thesis_bonus?: number | null
          tier?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_score?: number | null
          business_model_score?: number | null
          buyer_id?: string
          composite_score?: number
          created_at?: string
          data_completeness?: string | null
          deal_snapshot?: Json | null
          fit_reasoning?: string | null
          geography_score?: number | null
          hidden_from_deal?: boolean | null
          human_override_score?: number | null
          id?: string
          last_viewed_at?: string | null
          listing_id?: string
          owner_goals_score?: number | null
          pass_category?: string | null
          pass_reason?: string | null
          portfolio_score?: number | null
          rejected_at?: string | null
          rejection_category?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          scored_at?: string | null
          scored_by?: string | null
          service_score?: number | null
          size_score?: number | null
          status?: string
          thesis_bonus?: number | null
          tier?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_scores_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_scores_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      remarketing_universe_deals: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          listing_id: string
          notes: string | null
          status: string | null
          universe_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          status?: string | null
          universe_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          status?: string | null
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarketing_universe_deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_universe_deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_universe_deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_universe_deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "unmapped_primary_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remarketing_universe_deals_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "remarketing_buyer_universes"
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
          search_session_id: string | null
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
          search_session_id?: string | null
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
          search_session_id?: string | null
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
            referencedRelation: "listings_needing_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similar_deal_alerts_source_listing_id_fkey"
            columns: ["source_listing_id"]
            isOneToOne: false
            referencedRelation: "ranked_deals"
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
      trigger_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          status: string
          trigger_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          trigger_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          trigger_name?: string
          user_email?: string | null
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
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          first_seen_at: string | null
          full_referrer: string | null
          ga4_client_id: string | null
          id: string
          landing_page: string | null
          landing_page_query: string | null
          location: Json | null
          marketing_channel: string | null
          platform: string | null
          referrer: string | null
          region: string | null
          session_id: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          browser_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          first_seen_at?: string | null
          full_referrer?: string | null
          ga4_client_id?: string | null
          id?: string
          landing_page?: string | null
          landing_page_query?: string | null
          location?: Json | null
          marketing_channel?: string | null
          platform?: string | null
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          browser_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          first_seen_at?: string | null
          full_referrer?: string | null
          ga4_client_id?: string | null
          id?: string
          landing_page?: string | null
          landing_page_query?: string | null
          location?: Json | null
          marketing_channel?: string | null
          platform?: string | null
          referrer?: string | null
          region?: string | null
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
      user_journeys: {
        Row: {
          created_at: string | null
          first_blog_landing: string | null
          first_browser: string | null
          first_city: string | null
          first_country: string | null
          first_device_type: string | null
          first_external_referrer: string | null
          first_landing_page: string | null
          first_os: string | null
          first_referrer: string | null
          first_seen_at: string | null
          first_utm_campaign: string | null
          first_utm_content: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          first_utm_term: string | null
          ga4_client_id: string | null
          id: string
          is_bot: boolean | null
          is_production: boolean | null
          journey_stage: string | null
          last_page_path: string | null
          last_seen_at: string | null
          last_session_id: string | null
          milestones: Json | null
          total_page_views: number | null
          total_sessions: number | null
          total_time_seconds: number | null
          updated_at: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string | null
          first_blog_landing?: string | null
          first_browser?: string | null
          first_city?: string | null
          first_country?: string | null
          first_device_type?: string | null
          first_external_referrer?: string | null
          first_landing_page?: string | null
          first_os?: string | null
          first_referrer?: string | null
          first_seen_at?: string | null
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          ga4_client_id?: string | null
          id?: string
          is_bot?: boolean | null
          is_production?: boolean | null
          journey_stage?: string | null
          last_page_path?: string | null
          last_seen_at?: string | null
          last_session_id?: string | null
          milestones?: Json | null
          total_page_views?: number | null
          total_sessions?: number | null
          total_time_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string | null
          first_blog_landing?: string | null
          first_browser?: string | null
          first_city?: string | null
          first_country?: string | null
          first_device_type?: string | null
          first_external_referrer?: string | null
          first_landing_page?: string | null
          first_os?: string | null
          first_referrer?: string | null
          first_seen_at?: string | null
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          ga4_client_id?: string | null
          id?: string
          is_bot?: boolean | null
          is_production?: boolean | null
          journey_stage?: string | null
          last_page_path?: string | null
          last_seen_at?: string | null
          last_session_id?: string | null
          milestones?: Json | null
          total_page_views?: number | null
          total_sessions?: number | null
          total_time_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_journeys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          blog_landing_page: string | null
          browser: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          device_type: string | null
          ended_at: string | null
          first_touch_campaign: string | null
          first_touch_landing_page: string | null
          first_touch_medium: string | null
          first_touch_referrer: string | null
          first_touch_source: string | null
          ga4_client_id: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          is_bot: boolean | null
          is_production: boolean | null
          last_active_at: string | null
          lat: number | null
          lon: number | null
          original_external_referrer: string | null
          original_keyword: string | null
          original_source: string | null
          os: string | null
          referrer: string | null
          region: string | null
          session_duration_seconds: number | null
          session_id: string
          started_at: string | null
          timezone: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          blog_landing_page?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          first_touch_campaign?: string | null
          first_touch_landing_page?: string | null
          first_touch_medium?: string | null
          first_touch_referrer?: string | null
          first_touch_source?: string | null
          ga4_client_id?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          is_bot?: boolean | null
          is_production?: boolean | null
          last_active_at?: string | null
          lat?: number | null
          lon?: number | null
          original_external_referrer?: string | null
          original_keyword?: string | null
          original_source?: string | null
          os?: string | null
          referrer?: string | null
          region?: string | null
          session_duration_seconds?: number | null
          session_id: string
          started_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          blog_landing_page?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          first_touch_campaign?: string | null
          first_touch_landing_page?: string | null
          first_touch_medium?: string | null
          first_touch_referrer?: string | null
          first_touch_source?: string | null
          ga4_client_id?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          is_bot?: boolean | null
          is_production?: boolean | null
          last_active_at?: string | null
          lat?: number | null
          lon?: number | null
          original_external_referrer?: string | null
          original_keyword?: string | null
          original_source?: string | null
          os?: string | null
          referrer?: string | null
          region?: string | null
          session_duration_seconds?: number | null
          session_id?: string
          started_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      listings_needing_enrichment: {
        Row: {
          attempts: number | null
          created_at: string | null
          enriched_at: string | null
          enrichment_scheduled_at: string | null
          id: string | null
          internal_company_name: string | null
          internal_deal_memo_link: string | null
          last_error: string | null
          queue_status: string | null
          queued_at: string | null
          title: string | null
          website: string | null
        }
        Relationships: []
      }
      ranked_deals: {
        Row: {
          acquisition_type: string | null
          address: string | null
          ai_description: string | null
          business_model: string | null
          calculated_rank: number | null
          categories: string[] | null
          category: string | null
          competitive_position: string | null
          created_at: string | null
          custom_metric_label: string | null
          custom_metric_subtitle: string | null
          custom_metric_value: string | null
          custom_sections: Json | null
          customer_concentration: number | null
          customer_geography: string | null
          customer_types: string | null
          deal_identifier: string | null
          deal_industry_score: number | null
          deal_motivation_score: number | null
          deal_quality_score: number | null
          deal_size_score: number | null
          deal_total_score: number | null
          deleted_at: string | null
          description: string | null
          description_html: string | null
          description_json: Json | null
          display_rank: number | null
          ebitda: number | null
          ebitda_confidence: string | null
          ebitda_is_inferred: boolean | null
          ebitda_metric_subtitle: string | null
          ebitda_source_quote: string | null
          effective_ebitda: number | null
          effective_ebitda_confidence: string | null
          enriched_at: string | null
          enrichment_error_message: string | null
          enrichment_last_attempted_at: string | null
          enrichment_last_successful_at: string | null
          enrichment_status: string | null
          estimated_ebitda: number | null
          executive_summary: string | null
          external_id: string | null
          external_source: string | null
          extraction_sources: Json | null
          files: string[] | null
          final_rank: number | null
          founded_year: number | null
          full_time_employees: number | null
          general_notes: string | null
          geographic_states: string[] | null
          google_review_count: number | null
          growth_drivers: Json | null
          growth_trajectory: string | null
          has_management_team: boolean | null
          has_multiple_locations: boolean | null
          hero_description: string | null
          id: string | null
          image_url: string | null
          industry: string | null
          industry_tier: number | null
          industry_tier_name: string | null
          internal_company_name: string | null
          internal_contact_info: string | null
          internal_deal_memo_link: string | null
          internal_notes: string | null
          internal_primary_owner: string | null
          internal_salesforce_link: string | null
          investment_thesis: string | null
          is_owner_dependent: boolean | null
          key_quotes: string[] | null
          key_risks: Json | null
          last_ranked_at: string | null
          lead_source_id: string | null
          lead_source_notes: string | null
          linkedin_employee_count: number | null
          location: string | null
          location_radius_requirement: string | null
          management_depth: string | null
          manual_rank_override: number | null
          market_position: Json | null
          metric_3_custom_label: string | null
          metric_3_custom_subtitle: string | null
          metric_3_custom_value: string | null
          metric_3_type: string | null
          metric_4_custom_label: string | null
          metric_4_custom_subtitle: string | null
          metric_4_custom_value: string | null
          metric_4_type: string | null
          motivation_tier: string | null
          mr_notes: string | null
          notes: string | null
          notes_analyzed_at: string | null
          number_of_locations: number | null
          owner_email: string | null
          owner_first_name: string | null
          owner_goals: string | null
          owner_last_name: string | null
          owner_notes: string | null
          owner_phone: string | null
          owner_title: string | null
          ownership_structure: string | null
          part_time_employees: number | null
          presented_by_admin_id: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_owner_id: string | null
          product_revenue_percentage: number | null
          project_revenue_percentage: number | null
          rank_locked: boolean | null
          rank_source: string | null
          real_estate_info: string | null
          recurring_revenue_percentage: number | null
          referral_partner_id: string | null
          revenue: number | null
          revenue_confidence: string | null
          revenue_is_inferred: boolean | null
          revenue_metric_subtitle: string | null
          revenue_model: string | null
          revenue_model_breakdown: Json | null
          revenue_source_quote: string | null
          revenue_trend: string | null
          score_tier: string | null
          seller_interest_analyzed_at: string | null
          seller_interest_confidence: string | null
          seller_interest_notes: Json | null
          seller_interest_score: number | null
          seller_involvement_preference: string | null
          seller_motivation: string | null
          service_mix: string | null
          service_revenue_percentage: number | null
          services: string[] | null
          special_requirements: string | null
          status: string | null
          status_label: string | null
          status_tag: string | null
          tags: string[] | null
          team_page_employee_count: number | null
          technology_systems: string | null
          timeline_preference: string | null
          title: string | null
          transaction_preferences: Json | null
          updated_at: string | null
          visible_to_buyer_types: string[] | null
          website: string | null
        }
        Insert: {
          acquisition_type?: string | null
          address?: string | null
          ai_description?: string | null
          business_model?: string | null
          calculated_rank?: number | null
          categories?: string[] | null
          category?: string | null
          competitive_position?: string | null
          created_at?: string | null
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          customer_geography?: string | null
          customer_types?: string | null
          deal_identifier?: string | null
          deal_industry_score?: number | null
          deal_motivation_score?: number | null
          deal_quality_score?: number | null
          deal_size_score?: number | null
          deal_total_score?: number | null
          deleted_at?: string | null
          description?: string | null
          description_html?: string | null
          description_json?: Json | null
          display_rank?: never
          ebitda?: number | null
          ebitda_confidence?: string | null
          ebitda_is_inferred?: boolean | null
          ebitda_metric_subtitle?: string | null
          ebitda_source_quote?: string | null
          effective_ebitda?: never
          effective_ebitda_confidence?: never
          enriched_at?: string | null
          enrichment_error_message?: string | null
          enrichment_last_attempted_at?: string | null
          enrichment_last_successful_at?: string | null
          enrichment_status?: string | null
          estimated_ebitda?: number | null
          executive_summary?: string | null
          external_id?: string | null
          external_source?: string | null
          extraction_sources?: Json | null
          files?: string[] | null
          final_rank?: number | null
          founded_year?: number | null
          full_time_employees?: number | null
          general_notes?: string | null
          geographic_states?: string[] | null
          google_review_count?: number | null
          growth_drivers?: Json | null
          growth_trajectory?: string | null
          has_management_team?: boolean | null
          has_multiple_locations?: boolean | null
          hero_description?: string | null
          id?: string | null
          image_url?: string | null
          industry?: string | null
          industry_tier?: number | null
          industry_tier_name?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          is_owner_dependent?: boolean | null
          key_quotes?: string[] | null
          key_risks?: Json | null
          last_ranked_at?: string | null
          lead_source_id?: string | null
          lead_source_notes?: string | null
          linkedin_employee_count?: number | null
          location?: string | null
          location_radius_requirement?: string | null
          management_depth?: string | null
          manual_rank_override?: number | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          motivation_tier?: never
          mr_notes?: string | null
          notes?: string | null
          notes_analyzed_at?: string | null
          number_of_locations?: number | null
          owner_email?: string | null
          owner_first_name?: string | null
          owner_goals?: string | null
          owner_last_name?: string | null
          owner_notes?: string | null
          owner_phone?: string | null
          owner_title?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_owner_id?: string | null
          product_revenue_percentage?: number | null
          project_revenue_percentage?: number | null
          rank_locked?: boolean | null
          rank_source?: never
          real_estate_info?: string | null
          recurring_revenue_percentage?: number | null
          referral_partner_id?: string | null
          revenue?: number | null
          revenue_confidence?: string | null
          revenue_is_inferred?: boolean | null
          revenue_metric_subtitle?: string | null
          revenue_model?: string | null
          revenue_model_breakdown?: Json | null
          revenue_source_quote?: string | null
          revenue_trend?: string | null
          score_tier?: never
          seller_interest_analyzed_at?: string | null
          seller_interest_confidence?: string | null
          seller_interest_notes?: Json | null
          seller_interest_score?: number | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          service_mix?: string | null
          service_revenue_percentage?: number | null
          services?: string[] | null
          special_requirements?: string | null
          status?: string | null
          status_label?: string | null
          status_tag?: string | null
          tags?: string[] | null
          team_page_employee_count?: number | null
          technology_systems?: string | null
          timeline_preference?: string | null
          title?: string | null
          transaction_preferences?: Json | null
          updated_at?: string | null
          visible_to_buyer_types?: string[] | null
          website?: string | null
        }
        Update: {
          acquisition_type?: string | null
          address?: string | null
          ai_description?: string | null
          business_model?: string | null
          calculated_rank?: number | null
          categories?: string[] | null
          category?: string | null
          competitive_position?: string | null
          created_at?: string | null
          custom_metric_label?: string | null
          custom_metric_subtitle?: string | null
          custom_metric_value?: string | null
          custom_sections?: Json | null
          customer_concentration?: number | null
          customer_geography?: string | null
          customer_types?: string | null
          deal_identifier?: string | null
          deal_industry_score?: number | null
          deal_motivation_score?: number | null
          deal_quality_score?: number | null
          deal_size_score?: number | null
          deal_total_score?: number | null
          deleted_at?: string | null
          description?: string | null
          description_html?: string | null
          description_json?: Json | null
          display_rank?: never
          ebitda?: number | null
          ebitda_confidence?: string | null
          ebitda_is_inferred?: boolean | null
          ebitda_metric_subtitle?: string | null
          ebitda_source_quote?: string | null
          effective_ebitda?: never
          effective_ebitda_confidence?: never
          enriched_at?: string | null
          enrichment_error_message?: string | null
          enrichment_last_attempted_at?: string | null
          enrichment_last_successful_at?: string | null
          enrichment_status?: string | null
          estimated_ebitda?: number | null
          executive_summary?: string | null
          external_id?: string | null
          external_source?: string | null
          extraction_sources?: Json | null
          files?: string[] | null
          final_rank?: number | null
          founded_year?: number | null
          full_time_employees?: number | null
          general_notes?: string | null
          geographic_states?: string[] | null
          google_review_count?: number | null
          growth_drivers?: Json | null
          growth_trajectory?: string | null
          has_management_team?: boolean | null
          has_multiple_locations?: boolean | null
          hero_description?: string | null
          id?: string | null
          image_url?: string | null
          industry?: string | null
          industry_tier?: number | null
          industry_tier_name?: string | null
          internal_company_name?: string | null
          internal_contact_info?: string | null
          internal_deal_memo_link?: string | null
          internal_notes?: string | null
          internal_primary_owner?: string | null
          internal_salesforce_link?: string | null
          investment_thesis?: string | null
          is_owner_dependent?: boolean | null
          key_quotes?: string[] | null
          key_risks?: Json | null
          last_ranked_at?: string | null
          lead_source_id?: string | null
          lead_source_notes?: string | null
          linkedin_employee_count?: number | null
          location?: string | null
          location_radius_requirement?: string | null
          management_depth?: string | null
          manual_rank_override?: number | null
          market_position?: Json | null
          metric_3_custom_label?: string | null
          metric_3_custom_subtitle?: string | null
          metric_3_custom_value?: string | null
          metric_3_type?: string | null
          metric_4_custom_label?: string | null
          metric_4_custom_subtitle?: string | null
          metric_4_custom_value?: string | null
          metric_4_type?: string | null
          motivation_tier?: never
          mr_notes?: string | null
          notes?: string | null
          notes_analyzed_at?: string | null
          number_of_locations?: number | null
          owner_email?: string | null
          owner_first_name?: string | null
          owner_goals?: string | null
          owner_last_name?: string | null
          owner_notes?: string | null
          owner_phone?: string | null
          owner_title?: string | null
          ownership_structure?: string | null
          part_time_employees?: number | null
          presented_by_admin_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_owner_id?: string | null
          product_revenue_percentage?: number | null
          project_revenue_percentage?: number | null
          rank_locked?: boolean | null
          rank_source?: never
          real_estate_info?: string | null
          recurring_revenue_percentage?: number | null
          referral_partner_id?: string | null
          revenue?: number | null
          revenue_confidence?: string | null
          revenue_is_inferred?: boolean | null
          revenue_metric_subtitle?: string | null
          revenue_model?: string | null
          revenue_model_breakdown?: Json | null
          revenue_source_quote?: string | null
          revenue_trend?: string | null
          score_tier?: never
          seller_interest_analyzed_at?: string | null
          seller_interest_confidence?: string | null
          seller_interest_notes?: Json | null
          seller_interest_score?: number | null
          seller_involvement_preference?: string | null
          seller_motivation?: string | null
          service_mix?: string | null
          service_revenue_percentage?: number | null
          services?: string[] | null
          special_requirements?: string | null
          status?: string | null
          status_label?: string | null
          status_tag?: string | null
          tags?: string[] | null
          team_page_employee_count?: number | null
          technology_systems?: string | null
          timeline_preference?: string | null
          title?: string | null
          transaction_preferences?: Json | null
          updated_at?: string | null
          visible_to_buyer_types?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "listings_referral_partner_id_fkey"
            columns: ["referral_partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
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
      calculate_buyer_priority_score:
        | { Args: { buyer_type_param: string }; Returns: number }
        | {
            Args: {
              p_acquisition_timeline: string
              p_annual_revenue: string
              p_business_categories: string[]
              p_buyer_type: string
              p_capital_available: string
              p_company_name: string
              p_is_registered_user?: boolean
              p_target_locations: string[]
            }
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
      check_orphaned_auth_users: {
        Args: never
        Returns: {
          created_at: string
          user_email: string
          user_id: string
        }[]
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
      extract_domain: { Args: { email: string }; Returns: string }
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
      get_connection_request_analytics: {
        Args: { time_range?: string }
        Returns: {
          approved_requests: number
          conversion_rate: number
          pending_requests: number
          rejected_requests: number
          total_requests: number
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
      get_engagement_analytics: {
        Args: { time_range?: string }
        Returns: {
          active_users: number
          avg_engagement_score: number
          top_engaged_users: Json
          total_users: number
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
      increment: { Args: { x: number }; Returns: number }
      increment_journey_sessions: {
        Args: {
          p_page_path?: string
          p_session_id: string
          p_visitor_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      link_journey_to_user: {
        Args: { p_user_id: string; p_visitor_id: string }
        Returns: undefined
      }
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
        Args: { p_admin_id: string; p_deal_id: string; p_new_stage_id: string }
        Returns: undefined
      }
      normalize_company_name: { Args: { name: string }; Returns: string }
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
      reset_all_admin_notifications:
        | { Args: never; Returns: undefined }
        | { Args: { admin_uuid: string }; Returns: undefined }
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
      update_daily_metrics:
        | { Args: never; Returns: undefined }
        | { Args: { target_date?: string }; Returns: undefined }
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
              p_signed_at?: string
              p_signed_by_user_id?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_by_name?: string
              p_signed_by_user_id?: string
            }
            Returns: undefined
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
      update_journey_milestone: {
        Args: {
          p_milestone_key: string
          p_milestone_time?: string
          p_visitor_id: string
        }
        Returns: undefined
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
              p_signed_at?: string
              p_signed_by_user_id?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_firm_id: string
              p_is_signed: boolean
              p_signed_by_name?: string
              p_signed_by_user_id?: string
            }
            Returns: undefined
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
