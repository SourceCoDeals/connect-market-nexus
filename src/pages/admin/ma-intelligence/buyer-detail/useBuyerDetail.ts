import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MABuyer } from "@/lib/ma-intelligence/types";

export function useBuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("dealId");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [buyer, setBuyer] = useState<MABuyer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState<Partial<MABuyer>>({});

  const loadBuyer = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      const buyerData = data as unknown as MABuyer;
      setBuyer(buyerData);
      setFormData(buyerData);
    } catch (error: unknown) {
      toast({
        title: "Error loading buyer",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
      navigate("/admin/ma-intelligence/buyers");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    if (id) {
      loadBuyer();
    }
  }, [id, loadBuyer]);

  const handleEnrich = async () => {
    if (!buyer) return;

    try {
      const { queueBuyerEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueBuyerEnrichment([buyer.id]);

      toast({
        title: "Enrichment started",
        description: "Buyer enrichment is running in the background",
      });

      // Data will refresh via queue polling; do a deferred reload as fallback
      setTimeout(loadBuyer, 5000);
    } catch (error: unknown) {
      toast({
        title: "Error enriching buyer",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleArchive = async () => {
    if (!buyer) return;
    if (!confirm("Are you sure you want to archive this buyer?")) return;

    try {
      const { error } = await supabase
        .from("remarketing_buyers")
        .update({ archived: true })
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Buyer archived",
        description: "The buyer has been archived successfully",
      });

      navigate("/admin/ma-intelligence/buyers");
    } catch (error: unknown) {
      toast({
        title: "Error archiving buyer",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!buyer) return;
    if (!confirm("Are you sure you want to delete this buyer? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("remarketing_buyers")
        .delete()
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Buyer deleted",
        description: "The buyer has been deleted successfully",
      });

      navigate("/admin/ma-intelligence/buyers");
    } catch (error: unknown) {
      toast({
        title: "Error deleting buyer",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleApproveForDeal = async () => {
    if (!buyer || !dealId) return;

    try {
      // Check if a score record exists
      const { data: existingScore, error: existingScoreError } = await supabase
        .from("buyer_deal_scores")
        .select("id")
        .eq("buyer_id", buyer.id)
        .eq("deal_id", dealId)
        .single();
      if (existingScoreError) throw existingScoreError;

      if (existingScore) {
        // Update existing record
        const { error } = await supabase
          .from("buyer_deal_scores")
          .update({ selected_for_outreach: true })
          .eq("id", existingScore.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase.from("buyer_deal_scores").insert({
          buyer_id: buyer.id,
          deal_id: dealId,
          selected_for_outreach: true,
          scored_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      toast({
        title: "Buyer approved",
        description: "This buyer has been approved for the deal",
      });
    } catch (error: unknown) {
      toast({
        title: "Error approving buyer",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleSaveSection = async (_section: string) => {
    if (!buyer) return;

    try {
      // Extract only schema-compatible fields to avoid type errors
      const updateData: Record<string, unknown> = {};
      const schemaFields = [
        'pe_firm_name', 'pe_firm_website', 'pe_firm_linkedin', 'platform_company_name',
        'platform_website', 'buyer_linkedin', 'hq_city', 'hq_state', 'hq_country',
        'hq_region', 'other_office_locations', 'business_summary', 'industry_vertical',
        'business_type', 'services_offered', 'business_model', 'revenue_model',
        'go_to_market_strategy', 'num_platforms', 'total_acquisitions',
        'last_acquisition_date', 'acquisition_frequency', 'acquisition_appetite',
        'acquisition_timeline', 'min_revenue', 'max_revenue',
        'min_ebitda', 'max_ebitda', 'preferred_ebitda',
        'target_geographies', 'geographic_footprint', 'geographic_exclusions',
        'acquisition_geography', 'service_regions', 'target_services', 'target_industries',
        'industry_exclusions', 'thesis_summary', 'thesis_confidence',
        'service_mix_prefs', 'business_model_prefs',
        'addon_only', 'platform_only', 'has_fee_agreement', 'fee_agreement_status'
      ];

      for (const key of schemaFields) {
        if (key in formData) {
          updateData[key] = (formData as Record<string, unknown>)[key];
        }
      }

      const { error } = await supabase
        .from("remarketing_buyers")
        .update(updateData)
        .eq("id", buyer.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Buyer information has been updated successfully",
      });

      setEditingSection(null);
      loadBuyer();
    } catch (error: unknown) {
      toast({
        title: "Error saving changes",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = (_section: string) => {
    setEditingSection(null);
    setFormData(buyer || {});
  };

  const handleSaveNotes = async (notes: string) => {
    if (!buyer) return;
    try {
      const { error } = await supabase
        .from('remarketing_buyers')
        .update({ notes })
        .eq('id', buyer.id);

      if (error) throw error;
      setBuyer({ ...buyer, notes });
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : 'Failed to save notes');
    }
  };

  const handleAnalyzeNotes = async (notes: string) => {
    if (!buyer) return;
    setIsAnalyzingNotes(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-buyer-notes', {
        body: { buyerId: buyer.id, notesText: notes }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Notes analyzed successfully",
          description: `Extracted ${data.fieldsUpdated?.length || 0} fields from notes`,
        });
        loadBuyer();
      } else {
        throw new Error(data?.error || "Failed to analyze notes");
      }
    } catch (error: unknown) {
      toast({
        title: "Error analyzing notes",
        description: error instanceof Error ? error.message : "Failed to analyze notes",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  return {
    buyer,
    isLoading,
    activeTab,
    setActiveTab,
    editingSection,
    setEditingSection,
    isPassDialogOpen,
    setIsPassDialogOpen,
    isAnalyzingNotes,
    formData,
    setFormData,
    dealId,
    navigate,
    toast,
    loadBuyer,
    handleEnrich,
    handleArchive,
    handleDelete,
    handleApproveForDeal,
    handleSaveSection,
    handleCancelEdit,
    handleSaveNotes,
    handleAnalyzeNotes,
  };
}
