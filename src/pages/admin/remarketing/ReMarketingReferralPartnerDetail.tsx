import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  MoreHorizontal,
  Sparkles,
  Zap,
  BarChart3,
  Trash2,
  Archive,
  CheckCircle2,
  ChevronDown,
  Users,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddPartnerDialog } from "@/components/remarketing/AddPartnerDialog";
import { AddDealDialog } from "@/components/remarketing/AddDealDialog";
import { DealImportDialog } from "@/components/remarketing/DealImportDialog";
import { SubmissionReviewQueue } from "@/components/remarketing/SubmissionReviewQueue";
import { EnrichmentProgressIndicator } from "@/components/remarketing/EnrichmentProgressIndicator";
import { SingleDealEnrichmentDialog, type SingleDealEnrichmentResult } from "@/components/remarketing/SingleDealEnrichmentDialog";
import { ScoreTierBadge, getTierFromScore } from "@/components/remarketing/ScoreTierBadge";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [enrichmentResult, setEnrichmentResult] = useState<SingleDealEnrichmentResult | null>(null);
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "delete"; ids: string[] } | null>(null);
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null);

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

  // Fetch deals with enrichment/scoring fields
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["referral-partners", partnerId, "deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
           `id, title, internal_company_name, location, revenue, ebitda, category, website,
           status, created_at, full_time_employees, address_city, address_state,
           enriched_at, deal_total_score, deal_quality_score, 
           linkedin_employee_count, linkedin_employee_range,
           google_review_count, google_rating, is_priority_target`
        )
        .eq("referral_partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!partnerId,
  });

  // Fetch enrichment queue status for this partner's deals (all statuses for progress calc)
  const { data: enrichmentQueue } = useQuery({
    queryKey: ["referral-partners", partnerId, "enrichment-queue"],
    queryFn: async () => {
      if (!deals?.length) return [];
      const dealIds = deals.map((d) => d.id);
      const { data, error } = await supabase
        .from("enrichment_queue")
        .select("listing_id, status")
        .in("listing_id", dealIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!deals?.length,
    refetchInterval: (enrichmentQueue) => {
      const data = enrichmentQueue.state?.data;
      const hasActive = data?.some((d: any) => d.status === 'pending' || d.status === 'processing');
      return hasActive ? 5000 : false;
    },
  });

  // Fetch pending submissions
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

  // KPI calculations
  const kpis = useMemo(() => {
    if (!deals) return { total: 0, enriched: 0, scored: 0, avgQuality: 0 };
    const enriched = deals.filter((d) => d.enriched_at).length;
    const scored = deals.filter((d) => d.deal_quality_score != null).length;
    const qualityScores = deals
      .map((d) => d.deal_quality_score)
      .filter((s): s is number => s != null);
    const avgQuality = qualityScores.length
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;
    return { total: deals.length, enriched, scored, avgQuality };
  }, [deals]);

  // Enrichment queue progress
  const enrichmentProgress = useMemo(() => {
    if (!enrichmentQueue?.length) return null;
    const active = enrichmentQueue.filter((q: any) => q.status === 'pending' || q.status === 'processing');
    if (active.length === 0) return null; // all done, hide the bar
    const total = enrichmentQueue.length;
    const completed = enrichmentQueue.filter((q: any) => q.status === 'completed').length;
    const failed = enrichmentQueue.filter((q: any) => q.status === 'failed').length;
    return { total, completed, failed };
  }, [enrichmentQueue]);

  // Selection helpers
  const allSelected = deals?.length ? selectedDealIds.size === deals.length : false;
  const someSelected = selectedDealIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(deals?.map((d) => d.id) || []));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        .update({ share_password_hash: hash, share_password_plaintext: password } as never)
        .eq("id", partnerId!);
      if (error) throw error;
      return password;
    },
    onSuccess: (password) => {
      setLastGeneratedPassword(password);
      navigator.clipboard.writeText(password);
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
      toast.success(`New password copied to clipboard`, { duration: 10000 });
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

  // Bulk Enrich
  const handleBulkEnrich = async (mode: "unenriched" | "all") => {
    if (!deals?.length) return;
    const targets = mode === "unenriched"
      ? deals.filter((d) => !d.enriched_at)
      : deals;

    if (!targets.length) {
      toast.info("No deals to enrich");
      return;
    }

    const now = new Date().toISOString();
    const rows = targets.map((d) => ({
      listing_id: d.id,
      status: "pending",
      attempts: 0,
      queued_at: now,
    }));

    const { error } = await supabase
      .from("enrichment_queue")
      .upsert(rows, { onConflict: "listing_id" });

    if (error) {
      toast.error("Failed to queue enrichment");
      return;
    }

    toast.success(`Queued ${targets.length} deals for enrichment`);
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "enrichment-queue"] });

    // Trigger worker
    supabase.functions
      .invoke("process-enrichment-queue", { body: { source: "referral_partner_bulk" } })
      .catch(console.warn);
  };

  // Bulk Score
  const handleBulkScore = async (mode: "unscored" | "all") => {
    if (!deals?.length) return;
    const targets = mode === "unscored"
      ? deals.filter((d) => d.deal_quality_score == null)
      : deals;

    if (!targets.length) {
      toast.info("No deals to score");
      return;
    }

    toast.info(`Scoring ${targets.length} deals...`);

    let successCount = 0;
    for (const deal of targets) {
      try {
        await supabase.functions.invoke("calculate-deal-quality", {
          body: { listingId: deal.id },
        });
        successCount++;
      } catch {
        // continue
      }
    }

    toast.success(`Scored ${successCount} of ${targets.length} deals`);
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
  };

  // Single deal enrichment
  const handleEnrichDeal = async (dealId: string) => {
    toast.info("Enriching deal...");
    try {
      const { data, error } = await supabase.functions.invoke("enrich-deal", {
        body: { listingId: dealId },
      });
      if (error) throw error;
      setEnrichmentResult(data);
      setEnrichmentDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    } catch (err: any) {
      toast.error(`Enrichment failed: ${err.message}`);
    }
  };

  // Bulk approve (set status to active)
  const handleBulkApprove = async () => {
    const ids = Array.from(selectedDealIds);
    if (!ids.length) return;

    const { error } = await supabase
      .from("listings")
      .update({ status: "active" } as never)
      .in("id", ids);

    if (error) {
      toast.error("Failed to approve deals");
      return;
    }

    toast.success(`${ids.length} deals approved to All Deals`);
    setSelectedDealIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  // Bulk archive
  const handleBulkArchive = async () => {
    const ids = confirmAction?.ids || [];
    if (!ids.length) return;

    const { error } = await supabase
      .from("listings")
      .update({ status: "archived" } as never)
      .in("id", ids);

    if (error) {
      toast.error("Failed to archive deals");
    } else {
      toast.success(`${ids.length} deals archived`);
      setSelectedDealIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    }
    setConfirmAction(null);
  };

  // Bulk delete with FK cleanup
  const handleBulkDelete = async () => {
    const ids = confirmAction?.ids || [];
    if (!ids.length) return;

    try {
      // Clean up FK references
      for (const id of ids) {
        await supabase.from("enrichment_queue").delete().eq("listing_id", id);
        await supabase.from("collection_items").delete().eq("listing_id", id);
        await supabase.from("chat_conversations").delete().eq("listing_id", id);
        await supabase.from("referral_submissions").update({ listing_id: null } as never).eq("listing_id", id);
      }

      const { error } = await supabase.from("listings").delete().in("id", ids);
      if (error) throw error;

      // Update partner deal count
      const newCount = Math.max(0, (partner?.deal_count || 0) - ids.length);
      await supabase
        .from("referral_partners")
        .update({ deal_count: newCount } as never)
        .eq("id", partnerId!);

      toast.success(`${ids.length} deals permanently deleted`);
      setSelectedDealIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
    setConfirmAction(null);
  };

  // Handle deal created from AddDealDialog
  const handleDealCreated = async () => {
    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

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

  const getDomain = (url: string | null) => {
    if (!url) return null;
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
    } catch {
      return null;
    }
  };

  return (
    <TooltipProvider>
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

        {/* Share Link & Password Section */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">Partner Tracker Link</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {window.location.origin}/referrals/{partner.share_token || "..."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copy URL
              </Button>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-sm font-medium mb-1">Password</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {(partner as any)?.share_password_plaintext || lastGeneratedPassword || "Not set — click Reset Password"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {((partner as any)?.share_password_plaintext || lastGeneratedPassword) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pw = (partner as any)?.share_password_plaintext || lastGeneratedPassword;
                      navigator.clipboard.writeText(pw);
                      toast.success("Password copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Password
                  </Button>
                )}
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

        {/* KPI Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Deals</div>
              <div className="text-2xl font-bold">{kpis.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Enriched
              </div>
              <div className="text-2xl font-bold">{kpis.enriched}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> Scored
              </div>
              <div className="text-2xl font-bold">{kpis.scored}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Avg Quality</div>
              <div className="text-2xl font-bold">
                {kpis.avgQuality > 0 ? kpis.avgQuality.toFixed(0) : "-"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrichment Progress */}
        {enrichmentProgress && enrichmentProgress.total > 0 && (
          <EnrichmentProgressIndicator
            completedCount={enrichmentProgress.completed}
            totalCount={enrichmentProgress.total}
            progress={(enrichmentProgress.completed / enrichmentProgress.total) * 100}
            itemLabel="deals"
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
              <div className="flex items-center gap-2">
                {/* Bulk Enrich */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Sparkles className="h-4 w-4 mr-1" />
                      Enrich
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkEnrich("unenriched")}>
                      Enrich Unenriched
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkEnrich("all")}>
                      Re-enrich All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Bulk Score */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Score
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkScore("unscored")}>
                      Score Unscored
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkScore("all")}>
                      Recalculate All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          {/* Bulk Actions Toolbar */}
          {someSelected && (
            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="text-sm font-medium px-2">
                  {selectedDealIds.size} selected
                </span>
                <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Approve to All Deals
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfirmAction({ type: "archive", ids: Array.from(selectedDealIds) })
                  }
                >
                  <Archive className="h-3 w-3 mr-1" />
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() =>
                    setConfirmAction({ type: "delete", ids: Array.from(selectedDealIds) })
                  }
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">EBITDA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const domain = getDomain(deal.website);
                    const isEnriched = !!deal.enriched_at;

                    return (
                      <TableRow
                        key={deal.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          deal.is_priority_target
                            ? "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                            : ""
                        }`}
                        data-state={selectedDealIds.has(deal.id) ? "selected" : undefined}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedDealIds.has(deal.id)}
                            onCheckedChange={() => toggleSelect(deal.id)}
                            aria-label={`Select ${deal.title}`}
                          />
                        </TableCell>
                        <TableCell
                          className="font-medium"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          <div className="flex items-center gap-1.5">
                            {isEnriched && (
                              <Sparkles className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            )}
                            <span>{deal.internal_company_name || deal.title || "Untitled"}</span>
                          </div>
                          {domain && (
                            <div className="text-xs text-muted-foreground">{domain}</div>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          {deal.category || "-"}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          {deal.address_city && deal.address_state
                            ? `${deal.address_city}, ${deal.address_state}`
                            : deal.location || "-"}
                        </TableCell>
                        <TableCell
                          className="text-right text-sm"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          {formatCurrency(deal.revenue)}
                        </TableCell>
                        <TableCell
                          className="text-right text-sm"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          {formatCurrency(deal.ebitda)}
                        </TableCell>
                        <TableCell onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}>
                          {deal.status === "active" ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                          ) : deal.status === "draft" ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">Draft</Badge>
                          ) : deal.status === "archived" ? (
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200">Archived</Badge>
                          ) : (
                            <Badge variant="secondary">{deal.status || "Draft"}</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}>
                          {deal.deal_quality_score != null ? (
                            <ScoreTierBadge
                              tier={getTierFromScore(deal.deal_quality_score)}
                              score={deal.deal_quality_score}
                              showScore
                              size="sm"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}>
                          {deal.linkedin_employee_count ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-sm">
                                  <Users className="h-3 w-3 text-blue-600" />
                                  {deal.linkedin_employee_count.toLocaleString()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {deal.linkedin_employee_range || `${deal.linkedin_employee_count} employees`}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}>
                          {deal.google_review_count ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="h-3 w-3 text-amber-500" />
                                  {deal.google_review_count}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {deal.google_rating
                                  ? `${deal.google_rating.toFixed(1)}★ · ${deal.google_review_count} reviews`
                                  : `${deal.google_review_count} reviews`}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}
                        >
                          {format(new Date(deal.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/admin/remarketing/deals/${deal.id}`)}>
                                <ExternalLink className="h-3 w-3 mr-2" />
                                View Deal
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEnrichDeal(deal.id)}>
                                <Zap className="h-3 w-3 mr-2" />
                                Enrich Deal
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const newStatus = !deal.is_priority_target;
                                  const { error } = await supabase
                                    .from("listings")
                                    .update({ is_priority_target: newStatus })
                                    .eq("id", deal.id);
                                  if (error) {
                                    toast.error(error.message);
                                  } else {
                                    toast.success(newStatus ? "Marked as priority" : "Priority removed");
                                    queryClient.invalidateQueries({ queryKey: ["referral-partners", partnerId, "deals"] });
                                  }
                                }}
                                className={deal.is_priority_target ? "text-amber-600" : ""}
                              >
                                <Star className={`h-3 w-3 mr-2 ${deal.is_priority_target ? "fill-amber-500" : ""}`} />
                                {deal.is_priority_target ? "Remove Priority" : "Mark as Priority"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setConfirmAction({ type: "delete", ids: [deal.id] })}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
        />

        {/* Confirm Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "delete" ? "Delete Deals" : "Archive Deals"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "delete"
                  ? `This will permanently delete ${confirmAction.ids.length} deal(s) and all associated data. This cannot be undone.`
                  : `This will archive ${confirmAction?.ids.length} deal(s). They will remain in the partner tracker but won't appear in active All Deals.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmAction?.type === "delete" ? handleBulkDelete : handleBulkArchive}
                className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              >
                {confirmAction?.type === "delete" ? "Delete" : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}