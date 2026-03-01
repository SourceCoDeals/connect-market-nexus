import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MADeal } from "@/lib/ma-intelligence/types";
import type { ScoringAdjustmentsState } from "./types";

export function useDealDetailData(id: string | undefined) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deal, setDeal] = useState<MADeal | null>(null);
  const [tracker, setTracker] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isAddTranscriptDialogOpen, setIsAddTranscriptDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<MADeal>>({});

  // Scoring state
  const [scoringState, setScoringState] = useState<ScoringAdjustmentsState>({
    geoWeightMultiplier: 1.0,
    sizeWeightMultiplier: 1.0,
    serviceWeightMultiplier: 1.0,
    customScoringInstructions: "",
  });

  useEffect(() => {
    if (id) {
      loadDeal();
      loadScoringAdjustments();
    }
  }, [id]);

  const loadDeal = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          tracker:industry_trackers(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      const dealData = data as unknown as MADeal & { tracker: { id: string; name: string } | null };
      setDeal(dealData);
      setTracker(dealData.tracker);
      setFormData(dealData);
    } catch (error: unknown) {
      toast({
        title: "Error loading deal",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
      navigate("/admin/ma-intelligence/deals");
    } finally {
      setIsLoading(false);
    }
  };

  const loadScoringAdjustments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("deal_scoring_adjustments")
        .select("*")
        .eq("listing_id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setScoringState({
          geoWeightMultiplier: data.adjustment_value || 1.0,
          sizeWeightMultiplier: 1.0,
          serviceWeightMultiplier: 1.0,
          customScoringInstructions: data.reason || "",
        });
      }
    } catch (error: unknown) {
      console.error("Error loading scoring adjustments:", error);
    }
  };

  const handleEnrich = async () => {
    if (!deal) return;
    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      await queueDealEnrichment([deal.id]);
      toast({ title: "Enrichment started", description: "Deal enrichment is running in the background" });
      setTimeout(loadDeal, 5000);
    } catch (error: unknown) {
      toast({ title: "Error enriching deal", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleCalculateScore = async () => {
    if (!deal) return;
    try {
      await supabase.functions.invoke("score-deal-buyers", { body: { dealId: deal.id } });
      toast({ title: "Score calculation started", description: "Deal scoring is running in the background" });
      setTimeout(loadDeal, 5000);
    } catch (error: unknown) {
      toast({ title: "Error calculating score", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    if (!deal) return;
    if (!confirm("Are you sure you want to archive this deal?")) return;
    try {
      const { error } = await supabase.from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", deal.id);
      if (error) throw error;
      toast({ title: "Deal archived", description: "The deal has been archived successfully" });
      navigate("/admin/ma-intelligence/deals");
    } catch (error: unknown) {
      toast({ title: "Error archiving deal", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (!confirm("Are you sure you want to delete this deal? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from("deals").delete().eq("id", deal.id);
      if (error) throw error;
      toast({ title: "Deal deleted", description: "The deal has been deleted successfully" });
      navigate("/admin/ma-intelligence/deals");
    } catch (error: unknown) {
      toast({ title: "Error deleting deal", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleSaveSection = async (_section: string) => {
    if (!deal) return;
    try {
      const updateData: Record<string, unknown> = {};
      const schemaFields = [
        'deal_name', 'company_website', 'company_address', 'company_overview',
        'industry_type', 'service_mix', 'business_model', 'end_market_customers',
        'customer_concentration', 'customer_geography', 'headquarters', 'location_count',
        'employee_count', 'founded_year', 'ownership_structure', 'revenue',
        'ebitda_amount', 'ebitda_percentage',
        'financial_notes', 'owner_goals', 'special_requirements', 'contact_name',
        'contact_title', 'contact_email', 'contact_phone', 'contact_linkedin',
        'additional_info', 'transcript_link', 'geography'
      ];
      for (const key of schemaFields) {
        if (key in formData) {
          updateData[key] = (formData as Record<string, unknown>)[key];
        }
      }
      const { error } = await supabase.from("deals").update(updateData).eq("id", deal.id);
      if (error) throw error;
      toast({ title: "Changes saved", description: "Deal information has been updated successfully" });
      setEditingSection(null);
      loadDeal();
    } catch (error: unknown) {
      toast({ title: "Error saving changes", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleCancelEdit = (_section: string) => {
    setEditingSection(null);
    setFormData(deal || {});
  };

  const handleSaveScoringAdjustments = async () => {
    if (!deal) return;
    try {
      const { error } = await supabase.from("deal_scoring_adjustments").upsert({
        listing_id: deal.id,
        adjustment_type: "weight_multiplier",
        adjustment_value: scoringState.geoWeightMultiplier,
        reason: scoringState.customScoringInstructions || null,
      });
      if (error) throw error;
      toast({ title: "Scoring adjustments saved", description: "Custom scoring weights have been updated" });
    } catch (error: unknown) {
      toast({ title: "Error saving scoring adjustments", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  return {
    deal,
    tracker,
    isLoading,
    activeTab,
    setActiveTab,
    editingSection,
    setEditingSection,
    isAddTranscriptDialogOpen,
    setIsAddTranscriptDialogOpen,
    formData,
    setFormData,
    scoringState,
    setScoringState,
    loadDeal,
    handleEnrich,
    handleCalculateScore,
    handleArchive,
    handleDelete,
    handleSaveSection,
    handleCancelEdit,
    handleSaveScoringAdjustments,
  };
}
