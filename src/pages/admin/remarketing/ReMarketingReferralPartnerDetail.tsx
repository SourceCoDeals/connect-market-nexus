import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Copy,
  Edit,
  KeyRound,
  XCircle,
  Plus,
  Upload,
  Loader2,
  Building2,
  Mail,
  Phone,
  Calendar,
  Handshake,
  ExternalLink,
  Sparkles,
  Calculator,
  MoreHorizontal,
  ChevronDown,
  Globe,
  Linkedin,
  Star,
  Archive,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { AddPartnerDialog } from "@/components/remarketing/AddPartnerDialog";
import { AddDealDialog } from "@/components/remarketing/AddDealDialog";
import { DealImportDialog } from "@/components/remarketing/DealImportDialog";
import { SubmissionReviewQueue } from "@/components/remarketing/SubmissionReviewQueue";
import { ScoreTierBadge, getTierFromScore } from "@/components/remarketing/ScoreTierBadge";
import { SingleDealEnrichmentDialog, type SingleDealEnrichmentResult } from "@/components/remarketing/SingleDealEnrichmentDialog";
import { EnrichmentProgressIndicator } from "@/components/remarketing/EnrichmentProgressIndicator";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";

const formatCurrency = (value: number | null) => {
  if (!value) return "-";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

export default function ReMarketingReferralPartnerDetail() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast: uiToast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Enrichment state
  const [enrichingDealId, setEnrichingDealId] = useState<string | null>(null);
  const [enrichmentResult, setEnrichmentResult] = useState<SingleDealEnrichmentResult | null>(null);
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [isCalculatingScores, setIsCalculatingScores] = useState(false);

  // Multi-select + bulk actions state
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Enrichment progress tracking
  const { progress: enrichmentProgress, pauseEnrichment, resumeEnrichment, cancelEnrichment } = useEnrichmentProgress();

  // Fetch partner
  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["referral-partners", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_partners")
        .select("*")
        .eq("id", partnerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });

  // Fetch deals for this partner — include enrichment & scoring fields
  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ["referral-partners", partnerId, "deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `id, title, internal_company_name, location, revenue, ebitda, category, website,
           status, created_at, full_time_employees, address_city, address_state,
           enriched_at, deal_total_score, deal_quality_score,
           linkedin_employee_count, linkedin_employee_range,
           google_review_count, google_rating`
        )
        .eq("referral_partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });

  // Fetch pending submissions for this partner
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["referral-submissions", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_submissions")
        .select("*")
        .eq("referral_partner_id", partnerId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });

  // Copy share link
  const handleCopyShareLink = () => {
    if (!partner?.share_token) {
      toast.error("No share token available");
      return;
    }
    const url = `${window.location.origin}/referrals/${partner.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  };

  // Reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const array = new Uint8Array(12);
      crypto.getRandomValues(array);
      const password = Array.from(array, (b) => chars[b % chars.length]).join("");

      const { data: hashResult } = await supabase.functions.invoke(
        "validate-referral-access",
        { body: { action: "hash-password", password } }
      );

      const hash = hashResult?.hash || password;
      const { error } = await supabase
        .from("referral_partners")
        .update({ share_password_hash: hash } as never)
        .eq("id", partnerId!);
      if (error) throw error;
      return password;
    },
    onSuccess: (password) => {
      toast.success(`New password: ${password}`, { duration: 15000 });
    },
    onError: (error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    },
  });

  // Deactivate
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("referral_partners")
        .update({ is_active: !partner?.is_active } as never)
        .eq("id", partnerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
      toast.success(partner?.is_active ? "Partner deactivated" : "Partner activated");
    },
  });

  // Enrich a single deal
  const handleEnrichDeal = useCallback(async (dealId: string) => {
    setEnrichingDealId(dealId);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-deal", {
        body: { dealId },
      });

      if (error) throw error;

      setEnrichmentResult(data as SingleDealEnrichmentResult);
      setEnrichmentDialogOpen(true);

      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    } catch (error: any) {
      setEnrichmentResult({
        success: false,
        error: error.message || "Enrichment failed",
      });
      setEnrichmentDialogOpen(true);
    } finally {
      setEnrichingDealId(null);
    }
  }, [partnerId, queryClient]);

  // Enrich all partner deals (queue-based)
  const handleEnrichAllDeals = useCallback(async (mode: 'all' | 'unenriched') => {
    if (!deals || deals.length === 0) {
      uiToast({ title: "No deals", description: "No deals available to enrich", variant: "destructive" });
      return;
    }

    setIsEnrichingAll(true);
    try {
      const dealsToEnrich = mode === 'all'
        ? deals
        : deals.filter(d => !d.enriched_at);

      if (dealsToEnrich.length === 0) {
        uiToast({ title: "All deals enriched", description: "All deals have already been enriched" });
        setIsEnrichingAll(false);
        return;
      }

      const dealIds = dealsToEnrich.map(d => d.id);
      const nowIso = new Date().toISOString();

      // Reset enriched_at for re-enrichment
      if (mode === 'all') {
        await supabase
          .from('listings')
          .update({ enriched_at: null })
          .in('id', dealIds);
      }

      // Reset existing queue entries
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'pending',
          attempts: 0,
          started_at: null,
          completed_at: null,
          last_error: null,
          queued_at: nowIso,
          updated_at: nowIso,
        })
        .in('listing_id', dealIds);

      // Upsert missing queue rows
      await supabase
        .from('enrichment_queue')
        .upsert(
          dealIds.map(id => ({
            listing_id: id,
            status: 'pending',
            attempts: 0,
            queued_at: nowIso,
          })),
          { onConflict: 'listing_id', ignoreDuplicates: true }
        );

      uiToast({
        title: "Enrichment queued",
        description: `${dealIds.length} deal${dealIds.length > 1 ? 's' : ''} queued for enrichment`,
      });

      // Trigger worker
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'referral_partner_detail' } })
        .catch(console.warn);

      refetchDeals();
    } catch (error: any) {
      uiToast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsEnrichingAll(false);
    }
  }, [deals, partnerId, uiToast, refetchDeals]);

  // Calculate quality scores for partner deals
  const handleCalculateScores = useCallback(async (mode: 'all' | 'unscored') => {
    if (!deals || deals.length === 0) {
      uiToast({ title: "No deals", description: "No deals available to score", variant: "destructive" });
      return;
    }

    setIsCalculatingScores(true);
    try {
      const dealIds = mode === 'all'
        ? deals.map(d => d.id)
        : deals.filter(d => d.deal_total_score === null).map(d => d.id);

      if (dealIds.length === 0) {
        uiToast({ title: "All deals scored", description: "All deals already have quality scores" });
        setIsCalculatingScores(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('calculate-deal-quality', {
        body: mode === 'all'
          ? { forceRecalculate: true, dealIds }
          : { calculateAll: true, dealIds }
      });

      if (error) throw error;

      uiToast({
        title: "Scoring complete",
        description: `Calculated quality scores for ${data?.scored || 0} deals${data?.errors > 0 ? ` (${data.errors} errors)` : ''}`,
      });

      refetchDeals();
    } catch (error: any) {
      uiToast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCalculatingScores(false);
    }
  }, [deals, uiToast, refetchDeals]);

  // Handle deal created from AddDealDialog
  const handleDealCreated = async () => {
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  // Handle import complete
  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  const handleImportCompleteWithIds = async (importedIds: string[]) => {
    if (!partnerId || importedIds.length === 0) return;

    for (const id of importedIds) {
      await supabase
        .from("listings")
        .update({ referral_partner_id: partnerId } as never)
        .eq("id", id);
    }

    const currentCount = partner?.deal_count || 0;
    await supabase
      .from("referral_partners")
      .update({ deal_count: currentCount + importedIds.length } as never)
      .eq("id", partnerId);

    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    toast.success(`${importedIds.length} deals tagged to ${partner?.name}`);
  };

  // Multi-select handlers
  const handleToggleSelect = useCallback((dealId: string) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!deals) return;
    if (selectedDeals.size === deals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(deals.map(d => d.id)));
    }
  }, [deals, selectedDeals.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedDeals(new Set());
  }, []);

  // Bulk approve to All Deals (set status to 'active')
  const handleBulkApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      const dealIds = Array.from(selectedDeals);
      const { error } = await supabase
        .from('listings')
        .update({ status: 'active' })
        .in('id', dealIds);

      if (error) throw error;

      uiToast({
        title: "Deals approved",
        description: `${dealIds.length} deal(s) pushed to All Deals`,
      });
      setSelectedDeals(new Set());
      refetchDeals();
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    } catch (error: any) {
      uiToast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsApproving(false);
    }
  }, [selectedDeals, uiToast, refetchDeals, queryClient]);

  // Bulk archive
  const handleBulkArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      const dealIds = Array.from(selectedDeals);
      const { error } = await supabase
        .from('listings')
        .update({ status: 'archived' })
        .in('id', dealIds);

      if (error) throw error;

      uiToast({
        title: "Deals archived",
        description: `${dealIds.length} deal(s) have been archived`,
      });
      setSelectedDeals(new Set());
      setShowArchiveDialog(false);
      refetchDeals();
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    } catch (error: any) {
      uiToast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  }, [selectedDeals, uiToast, refetchDeals, queryClient]);

  // Bulk delete (with FK cleanup)
  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const dealIds = Array.from(selectedDeals);

      for (const dealId of dealIds) {
        await supabase.from('alert_delivery_logs').delete().eq('listing_id', dealId);
        await supabase.from('buyer_approve_decisions').delete().eq('listing_id', dealId);
        await supabase.from('buyer_learning_history').delete().eq('listing_id', dealId);
        await supabase.from('buyer_pass_decisions').delete().eq('listing_id', dealId);
        await supabase.from('chat_conversations').delete().eq('listing_id', dealId);
        await supabase.from('collection_items').delete().eq('listing_id', dealId);
        await supabase.from('connection_requests').delete().eq('listing_id', dealId);
        await supabase.from('deal_ranking_history').delete().eq('listing_id', dealId);
        await supabase.from('deal_referrals').delete().eq('listing_id', dealId);
        await supabase.from('deals').delete().eq('listing_id', dealId);
        await supabase.from('deal_scoring_adjustments').delete().eq('listing_id', dealId);
        await supabase.from('deal_transcripts').delete().eq('listing_id', dealId);
        await supabase.from('enrichment_queue').delete().eq('listing_id', dealId);
        await supabase.from('listing_analytics').delete().eq('listing_id', dealId);
        await supabase.from('listing_conversations').delete().eq('listing_id', dealId);
        await supabase.from('outreach_records').delete().eq('listing_id', dealId);
        await supabase.from('owner_intro_notifications').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_outreach').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_scores').delete().eq('listing_id', dealId);
        await supabase.from('remarketing_universe_deals').delete().eq('listing_id', dealId);
        await supabase.from('saved_listings').delete().eq('listing_id', dealId);
        await supabase.from('similar_deal_alerts').delete().eq('source_listing_id', dealId);
        const { error } = await supabase.from('listings').delete().eq('id', dealId);
        if (error) throw error;
      }

      uiToast({
        title: "Deals deleted",
        description: `${dealIds.length} deal(s) permanently deleted`,
      });
      setSelectedDeals(new Set());
      setShowDeleteDialog(false);
      refetchDeals();
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
    } catch (error: any) {
      uiToast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDeals, uiToast, refetchDeals, queryClient, partnerId]);

  // Compute stats
  const dealStats = (() => {
    if (!deals?.length) return { total: 0, enriched: 0, scored: 0, avgScore: 0 };
    const enriched = deals.filter(d => d.enriched_at).length;
    const scored = deals.filter(d => d.deal_total_score !== null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, d) => sum + (d.deal_total_score || 0), 0) / scored.length)
      : 0;
    return { total: deals.length, enriched, scored: scored.length, avgScore };
  })();

  if (partnerLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex-1 p-6">
        <Button variant="ghost" onClick={() => navigate("/admin/remarketing/referral-partners")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>
        <div className="text-center py-12 text-muted-foreground">Partner not found</div>
      </div>
    );
  }

  const pendingCount = submissions?.length || 0;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/remarketing/referral-partners")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Handshake className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{partner.name}</h1>
                <Badge variant={partner.is_active ? "default" : "secondary"}>
                  {partner.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                {partner.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {partner.company}
                  </span>
                )}
                {partner.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {partner.email}
                  </span>
                )}
                {partner.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {partner.phone}
                  </span>
                )}
                {partner.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Added {format(new Date(partner.created_at), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddDealOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Deal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Import Deals
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deactivateMutation.mutate()}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {partner.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>
      </div>

      {/* Share Link Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1">Partner Tracker Link</p>
              <p className="text-xs text-muted-foreground font-mono">
                {window.location.origin}/referrals/{partner.share_token || "..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending}
              >
                <KeyRound className="h-3 w-3 mr-1" />
                Reset Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deal Stats KPIs */}
      {dealStats.total > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Deals</p>
              <p className="text-2xl font-bold">{dealStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Enriched</p>
              <p className="text-2xl font-bold">
                {dealStats.enriched}
                <span className="text-sm font-normal text-muted-foreground">/{dealStats.total}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Scored</p>
              <p className="text-2xl font-bold">
                {dealStats.scored}
                <span className="text-sm font-normal text-muted-foreground">/{dealStats.total}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Quality Score</p>
              <p className="text-2xl font-bold">
                {dealStats.avgScore > 0 ? dealStats.avgScore : "-"}
                {dealStats.avgScore > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enrichment Progress */}
      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onPause={pauseEnrichment}
          onResume={resumeEnrichment}
          onCancel={cancelEnrichment}
        />
      )}

      {/* Pending Submissions */}
      {pendingCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Pending Submissions
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {pendingCount}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionReviewQueue
              submissions={submissions || []}
              isLoading={submissionsLoading}
              showPartnerColumn={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Deals Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Referred Deals ({deals?.length || 0})
            </CardTitle>
            {deals && deals.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Enrich dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isEnrichingAll}
                    >
                      {isEnrichingAll ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Enrich
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEnrichAllDeals('unenriched')}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Enrich Unenriched ({deals.filter(d => !d.enriched_at).length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleEnrichAllDeals('all')}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Re-enrich All ({deals.length})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Score dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isCalculatingScores}
                    >
                      {isCalculatingScores ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Calculator className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Score
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCalculateScores('unscored')}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Score Unscored ({deals.filter(d => d.deal_total_score === null).length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleCalculateScores('all')}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Recalculate All ({deals.length})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dealsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !deals?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No deals referred by this partner yet</p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={deals.length > 0 && selectedDeals.size === deals.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">EBITDA</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Quality</TableHead>
                    <TableHead className="text-center">LinkedIn</TableHead>
                    <TableHead className="text-center">Reviews</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const score = deal.deal_total_score;
                    const isEnrichingThis = enrichingDealId === deal.id;
                    const dealStatus = deal.status || "draft";

                    return (
                      <TableRow
                        key={deal.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedDeals.has(deal.id)}
                            onCheckedChange={() => handleToggleSelect(deal.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>{deal.internal_company_name || deal.title || "Untitled"}</span>
                            {deal.enriched_at && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Enriched {format(new Date(deal.enriched_at), "MMM d, yyyy")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {deal.website && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Globe className="h-3 w-3" />
                              {deal.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {deal.category || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {deal.address_city && deal.address_state
                            ? `${deal.address_city}, ${deal.address_state}`
                            : deal.location || "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(deal.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(deal.ebitda)}
                        </TableCell>
                        {/* Status */}
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              dealStatus === "active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : dealStatus === "archived"
                                ? "bg-gray-100 text-gray-600 border-gray-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {dealStatus === "active" ? "Active" : dealStatus === "archived" ? "Archived" : "Draft"}
                          </Badge>
                        </TableCell>
                        {/* Quality Score */}
                        <TableCell className="text-center">
                          {score !== null && score !== undefined ? (
                            <ScoreTierBadge
                              tier={getTierFromScore(score)}
                              score={score}
                              showScore
                              showLabel={false}
                              size="sm"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {/* LinkedIn */}
                        <TableCell className="text-center">
                          {deal.linkedin_employee_count ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-sm">
                                  <Linkedin className="h-3 w-3 text-blue-600" />
                                  {deal.linkedin_employee_count.toLocaleString()}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {deal.linkedin_employee_range || `${deal.linkedin_employee_count} employees`}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {/* Google Reviews */}
                        <TableCell className="text-center">
                          {deal.google_review_count ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-sm">
                                  <Star className="h-3 w-3 text-amber-500" />
                                  {deal.google_review_count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {deal.google_rating ? `${deal.google_rating.toFixed(1)} rating` : ''} {deal.google_review_count} reviews
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(deal.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEnrichDeal(deal.id)}
                                disabled={isEnrichingThis}
                              >
                                {isEnrichingThis ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                {deal.enriched_at ? "Re-enrich" : "Enrich"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Deal
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedDeals.size > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm font-medium">
                {selectedDeals.size} selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <XCircle className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleBulkApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve to All Deals
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => setShowArchiveDialog(true)}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedDeals.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected deals to the archive. They will remain in this
              partner's tracker but won't appear in the active All Deals list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              disabled={isArchiving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {selectedDeals.size} Deal(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected deals and all related data
              (transcripts, scores, outreach records, etc.). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      <AddPartnerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingPartner={partner}
      />

      <AddDealDialog
        open={addDealOpen}
        onOpenChange={setAddDealOpen}
        onDealCreated={handleDealCreated}
        referralPartnerId={partnerId}
      />

      <DealImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
        onImportCompleteWithIds={handleImportCompleteWithIds}
        referralPartnerId={partnerId}
      />

      <SingleDealEnrichmentDialog
        open={enrichmentDialogOpen}
        onOpenChange={setEnrichmentDialogOpen}
        result={enrichmentResult}
        onRetry={enrichingDealId ? () => handleEnrichDeal(enrichingDealId) : undefined}
      />
    </div>
  );
}
