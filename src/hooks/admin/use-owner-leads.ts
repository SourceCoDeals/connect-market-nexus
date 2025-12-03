
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface OwnerLead {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  company_name: string | null;
  business_website: string | null;
  estimated_revenue_range: string | null;
  sale_timeline: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useOwnerLeads() {
  return useQuery({
    queryKey: ["owner-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_leads")
        .select("*")
        .eq("lead_type", "owner")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OwnerLead[];
    },
  });
}

export function useUpdateOwnerLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("inbound_leads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-leads"] });
      toast({
        title: "Status updated",
        description: "Lead status has been updated.",
      });
    },
    onError: (error) => {
      console.error("Error updating lead status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update lead status.",
      });
    },
  });
}

// Helper to format revenue range for display
export function formatRevenueRange(range: string | null): string {
  if (!range) return "—";
  const labels: Record<string, string> = {
    under_1m: "Under $1M",
    "1m_5m": "$1M - $5M",
    "5m_10m": "$5M - $10M",
    "10m_25m": "$10M - $25M",
    "25m_50m": "$25M - $50M",
    "50m_plus": "$50M+",
  };
  return labels[range] || range;
}

// Helper to format sale timeline for display
export function formatSaleTimeline(timeline: string | null): string {
  if (!timeline) return "—";
  const labels: Record<string, string> = {
    actively_exploring: "Actively exploring now",
    within_6_months: "Within 6 months",
    "6_12_months": "6-12 months",
    "1_2_years": "1-2 years",
    just_exploring: "Just exploring",
  };
  return labels[timeline] || timeline;
}
