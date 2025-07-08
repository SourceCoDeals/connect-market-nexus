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
      connection_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          decision_at: string | null
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
      engagement_scores: {
        Row: {
          connections_requested: number
          created_at: string
          id: string
          last_active: string | null
          listings_saved: number
          listings_viewed: number
          score: number
          total_session_time: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          connections_requested?: number
          created_at?: string
          id?: string
          last_active?: string | null
          listings_saved?: number
          listings_viewed?: number
          score?: number
          total_session_time?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          connections_requested?: number
          created_at?: string
          id?: string
          last_active?: string | null
          listings_saved?: number
          listings_viewed?: number
          score?: number
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
      listings: {
        Row: {
          category: string
          created_at: string
          description: string
          ebitda: number
          files: string[] | null
          id: string
          image_url: string | null
          location: string
          owner_notes: string | null
          revenue: number
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          ebitda: number
          files?: string[] | null
          id?: string
          image_url?: string | null
          location: string
          owner_notes?: string | null
          revenue: number
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          ebitda?: number
          files?: string[] | null
          id?: string
          image_url?: string | null
          location?: string
          owner_notes?: string | null
          revenue?: number
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          aum: string | null
          bio: string | null
          buyer_type: string | null
          company: string | null
          company_name: string | null
          created_at: string
          email: string
          email_verified: boolean
          estimated_revenue: string | null
          first_name: string
          fund_size: string | null
          funded_by: string | null
          funding_source: string | null
          id: string
          ideal_target: string | null
          investment_size: string | null
          is_admin: boolean | null
          is_funded: string | null
          last_name: string
          needs_loan: string | null
          phone_number: string | null
          target_company_size: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          approval_status?: string
          aum?: string | null
          bio?: string | null
          buyer_type?: string | null
          company?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          estimated_revenue?: string | null
          first_name: string
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          id: string
          ideal_target?: string | null
          investment_size?: string | null
          is_admin?: boolean | null
          is_funded?: string | null
          last_name: string
          needs_loan?: string | null
          phone_number?: string | null
          target_company_size?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          approval_status?: string
          aum?: string | null
          bio?: string | null
          buyer_type?: string | null
          company?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          estimated_revenue?: string | null
          first_name?: string
          fund_size?: string | null
          funded_by?: string | null
          funding_source?: string | null
          id?: string
          ideal_target?: string | null
          investment_size?: string | null
          is_admin?: boolean | null
          is_funded?: string | null
          last_name?: string
          needs_loan?: string | null
          phone_number?: string | null
          target_company_size?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      update_engagement_scores: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
