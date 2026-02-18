import { useState, useMemo, useCallback, useEffect } from "react";
import { formatCompactCurrency } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import {
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calculator,
  XCircle,
  MoreHorizontal,
  Users,
  Clock,
  Zap,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ───

interface ValuationLead {
  id: string;
  calculator_type: string;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  linkedin_url: string | null;
  industry: string | null;
  region: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  valuation_low: number | null;
  valuation_mid: number | null;
  valuation_high: number | null;
  quality_tier: string | null;
  quality_label: string | null;
  exit_timing: string | null;
  open_to_intros: boolean | null;
  cta_clicked: boolean | null;
  readiness_score: number | null;
  growth_trend: string | null;
  owner_dependency: string | null;
  locations_count: number | null;
  buyer_lane: string | null;
  revenue_model: string | null;
  lead_score: number | null;
  scoring_notes: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  pushed_listing_id: string | null;
  status: string | null;
  excluded: boolean | null;
  exclusion_reason: string | null;
  created_at: string;
  updated_at: string;
  lead_source: string | null;
  source_submission_id: string | null;
  synced_at: string | null;
  calculator_specific_data: Record<string, unknown> | null;
  raw_calculator_inputs: Record<string, unknown> | null;
  raw_valuation_results: Record<string, unknown> | null;
}

type Timeframe = "today" | "7d" | "14d" | "30d" | "90d" | "all";

type SortColumn =
  | "display_name"
  | "industry"
  | "revenue"
  | "ebitda"
  | "valuation"
  | "exit_timing"
  | "quality"
  | "score"
  | "created_at"
  | "pushed";
type SortDirection = "asc" | "desc";

// ─── Helpers ───

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com",
  "proton.me", "icloud.com", "live.com", "yahoo.com.au", "hotmail.se",
  "bellsouth.net", "mac.com", "webxio.pro", "leabro.com", "coursora.com",
  "mail.com", "zoho.com", "yandex.com", "protonmail.com",
]);

/** Clean a raw website value down to just the domain (no protocol, no www, no path). Returns null if invalid. */
function cleanWebsiteToDomain(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const v = raw.trim();
  // Skip if it's an email address, not a URL
  if (v.includes("@")) return null;
  // Skip obviously invalid (commas, spaces in domain)
  if (/[,\s]/.test(v.replace(/^https?:\/\//i, "").split("/")[0])) return null;
  // Strip any protocol (including common typos like htpps://)
  const noProto = v.replace(/^[a-z]{3,6}:\/\//i, "");
  // Strip www. prefix
  const noWww = noProto.replace(/^www\./i, "");
  // Strip path and query string — keep only hostname
  const domain = noWww.split("/")[0].split("?")[0].split("#")[0];
  if (!domain || !domain.includes(".")) return null;
  // Skip blacklisted placeholder domains
  if (/^(test|no|example)\./i.test(domain)) return null;
  return domain.toLowerCase();
}

const TLD_REGEX = /\.(com|net|org|io|co|ai|us|uk|ca|au|nz|ae|za|se|nl|br|fj|in|de|fr|es|it|jp|kr|mx|school|pro|app|dev|vc)(\.[a-z]{2})?$/i;

/** Extract a presentable business name from website or email domain. */
function extractBusinessName(lead: ValuationLead): string {
  // Use DB business_name if it's already good
  if (lead.business_name && !lead.business_name.endsWith("'s Business")) {
    return lead.business_name;
  }

  // Try website domain first
  const domain = cleanWebsiteToDomain(lead.website);
  if (domain) {
    const cleaned = domain.replace(TLD_REGEX, "");
    if (cleaned && !cleaned.match(/^(test|no|example)$/i)) {
      return toTitleCase(cleaned.replace(/[-_.]/g, " "));
    }
  }

  // Try email domain (skip generic providers)
  if (lead.email) {
    const emailDomain = lead.email.split("@")[1]?.toLowerCase();
    if (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
      const name = emailDomain
        .split(".")[0]
        .replace(/[0-9]+$/, "")
        .replace(/[-_]/g, " ");
      if (name) return toTitleCase(name);
    }
  }

  // Final fallback
  return lead.display_name || "\u2014";
}

/** Infer a displayable website URL from the lead's website or email domain. */
function inferWebsite(lead: ValuationLead): string | null {
  const domain = cleanWebsiteToDomain(lead.website);
  if (domain) return domain;
  if (lead.email) {
    const emailDomain = lead.email.split("@")[1]?.toLowerCase();
    if (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
      return emailDomain;
    }
  }
  return null;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Build a full listing insert object from a valuation lead, preserving all valuable data. */
function buildListingFromLead(lead: ValuationLead) {
  const businessName = extractBusinessName(lead);
  const cleanDomain = inferWebsite(lead);
  const title = businessName !== "\u2014" ? businessName : lead.full_name || "Valuation Lead";

  // Build seller motivation from exit timing + open_to_intros
  const motivationParts: string[] = [];
  if (lead.exit_timing === "now") motivationParts.push("Looking to exit now");
  else if (lead.exit_timing === "1-2years") motivationParts.push("Exit in 1-2 years");
  else if (lead.exit_timing === "exploring") motivationParts.push("Exploring options");
  if (lead.open_to_intros) motivationParts.push("Open to buyer introductions");

  // Build internal notes with lead intelligence summary
  const noteLines: string[] = [
    `--- Valuation Calculator Lead Intelligence ---`,
    `Source: ${lead.calculator_type === "auto_shop" ? "Auto Shop" : lead.calculator_type === "general" ? "General" : lead.calculator_type} Calculator`,
    `Submitted: ${new Date(lead.created_at).toLocaleDateString()}`,
  ];
  if (lead.lead_score != null) noteLines.push(`Lead Score: ${lead.lead_score}/100`);
  if (lead.quality_label) noteLines.push(`Quality: ${lead.quality_label} (tier: ${lead.quality_tier || "—"})`);
  if (lead.readiness_score != null) noteLines.push(`Readiness: ${lead.readiness_score}/100`);
  if (lead.exit_timing) noteLines.push(`Exit Timing: ${lead.exit_timing}`);
  if (lead.open_to_intros != null) noteLines.push(`Open to Intros: ${lead.open_to_intros ? "Yes" : "No"}`);
  if (lead.owner_dependency) noteLines.push(`Owner Dependency: ${lead.owner_dependency}`);
  if (lead.buyer_lane) noteLines.push(`Buyer Lane: ${lead.buyer_lane}`);
  if (lead.valuation_low != null && lead.valuation_high != null) {
    noteLines.push(`Self-Assessed Valuation: $${(lead.valuation_low / 1e6).toFixed(1)}M – $${(lead.valuation_high / 1e6).toFixed(1)}M (mid: $${((lead.valuation_mid || 0) / 1e6).toFixed(1)}M)`);
  }
  if (lead.scoring_notes) noteLines.push(`Scoring Notes: ${lead.scoring_notes}`);

  // Parse "City, ST, Country" → address_city, address_state
  const locationParts = lead.location?.split(",").map(s => s.trim());
  const address_city = locationParts?.[0] || null;
  const address_state = locationParts?.[1]?.length === 2 ? locationParts[1] : null;

  return {
    // Identity
    title,
    internal_company_name: title,
    deal_source: "valuation_calculator",
    deal_identifier: `vlead_${lead.id.slice(0, 8)}`,
    status: "active",
    is_internal_deal: true,
    pushed_to_all_deals: true,
    pushed_to_all_deals_at: new Date().toISOString(),

    // Contact
    main_contact_name: lead.full_name || null,
    main_contact_email: lead.email || null,
    main_contact_phone: lead.phone || null,
    website: cleanDomain ? `https://${cleanDomain}` : null,
    linkedin_url: lead.linkedin_url || null,

    // Business
    industry: lead.industry || null,
    location: lead.location || null,
    address_city,
    address_state,
    revenue: lead.revenue,
    ebitda: lead.ebitda,
    revenue_model: lead.revenue_model || null,
    growth_trajectory: lead.growth_trend || null,
    number_of_locations: lead.locations_count || null,

    // Seller intelligence
    seller_motivation: motivationParts.join(". ") || null,
    owner_goals: lead.exit_timing ? `Exit timing: ${lead.exit_timing}${lead.open_to_intros ? ". Open to buyer introductions." : ""}` : null,

    // Internal intelligence (admin-only)
    internal_notes: noteLines.join("\n"),
  } as never;
}

function getFromDate(tf: Timeframe): string | null {
  if (tf === "all") return null;
  const now = new Date();
  const days = tf === "today" ? 1 : tf === "7d" ? 7 : tf === "14d" ? 14 : tf === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function scorePillClass(score: number | null): string {
  if (score == null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  if (score >= 20) return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-600";
}

function exitTimingBadge(timing: string | null) {
  if (!timing) return null;
  const config: Record<string, { label: string; className: string }> = {
    now: { label: "Exit Now", className: "bg-red-50 text-red-700 border-red-200" },
    "1-2years": { label: "1-2 Years", className: "bg-amber-50 text-amber-700 border-amber-200" },
    exploring: { label: "Exploring", className: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const c = config[timing] || { label: timing, className: "bg-gray-50 text-gray-600 border-gray-200" };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", c.className)}>
      {c.label}
    </Badge>
  );
}

function qualityBadge(label: string | null) {
  if (!label) return null;
  const config: Record<string, string> = {
    "Very Strong": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Solid": "bg-blue-50 text-blue-700 border-blue-200",
    "Average": "bg-amber-50 text-amber-700 border-amber-200",
    "Needs Work": "bg-red-50 text-red-700 border-red-200",
  };
  const cls = config[label] || "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", cls)}>
      {label}
    </Badge>
  );
}

function calculatorBadge(type: string) {
  const config: Record<string, { label: string; className: string }> = {
    general: { label: "General", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    auto_shop: { label: "Auto Shop", className: "bg-blue-50 text-blue-700 border-blue-200" },
    hvac: { label: "HVAC", className: "bg-orange-50 text-orange-700 border-orange-200" },
    collision: { label: "Collision", className: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  const c = config[type] || { label: type.replace(/_/g, " "), className: "bg-gray-50 text-gray-600 border-gray-200" };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", c.className)}>
      {c.label}
    </Badge>
  );
}

// ─── Component ───

export default function ValuationLeads() {
  const queryClient = useQueryClient();


  // Calculator type tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Timeframe
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const fromDate = getFromDate(timeframe);

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isPushEnriching, setIsPushEnriching] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);

  // Fetch valuation leads
  const {
    data: leads,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "valuation-leads"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const allData: ValuationLead[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("valuation_leads")
          .select("*")
          .eq("excluded", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          // PostgREST may return NUMERIC columns as strings — normalize at boundary
          const normalized = (data as ValuationLead[]).map((row) => ({
            ...row,
            revenue: row.revenue != null ? Number(row.revenue) : null,
            ebitda: row.ebitda != null ? Number(row.ebitda) : null,
            valuation_low: row.valuation_low != null ? Number(row.valuation_low) : null,
            valuation_mid: row.valuation_mid != null ? Number(row.valuation_mid) : null,
            valuation_high: row.valuation_high != null ? Number(row.valuation_high) : null,
            lead_score: row.lead_score != null ? Number(row.lead_score) : null,
            readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
            locations_count: row.locations_count != null ? Number(row.locations_count) : null,
          }));
          allData.push(...normalized);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Get distinct calculator types for tabs
  const calculatorTypes = useMemo(() => {
    if (!leads) return [];
    const types = new Set(leads.map((l) => l.calculator_type));
    return Array.from(types).sort();
  }, [leads]);

  // Filter by tab + timeframe
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    let filtered = leads;

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((l) => l.calculator_type === activeTab);
    }

    // Timeframe filter
    if (fromDate) {
      filtered = filtered.filter((l) => l.created_at >= fromDate);
    }

    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "display_name":
          valA = (a.display_name || "").toLowerCase();
          valB = (b.display_name || "").toLowerCase();
          break;
        case "industry":
          valA = (a.industry || "").toLowerCase();
          valB = (b.industry || "").toLowerCase();
          break;
        case "revenue":
          valA = a.revenue ?? -1;
          valB = b.revenue ?? -1;
          break;
        case "ebitda":
          valA = a.ebitda ?? -1;
          valB = b.ebitda ?? -1;
          break;
        case "valuation":
          valA = a.valuation_mid ?? -1;
          valB = b.valuation_mid ?? -1;
          break;
        case "exit_timing":
          const timingOrder: Record<string, number> = { now: 3, "1-2years": 2, exploring: 1 };
          valA = timingOrder[a.exit_timing || ""] ?? 0;
          valB = timingOrder[b.exit_timing || ""] ?? 0;
          break;
        case "quality":
          valA = a.readiness_score ?? -1;
          valB = b.readiness_score ?? -1;
          break;
        case "score":
          valA = a.lead_score ?? -1;
          valB = b.lead_score ?? -1;
          break;
        case "created_at":
          valA = a.created_at || "";
          valB = b.created_at || "";
          break;
        case "pushed":
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [leads, activeTab, fromDate, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  // Reset page and clear selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, timeframe, sortColumn, sortDirection]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Selection helpers
  const allSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Push to All Deals — creates a listing row from valuation_leads data
  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);

      let successCount = 0;
      let errorCount = 0;
      for (const lead of leadsToProcess) {
        const { data: listing, error: insertError } = await supabase
          .from("listings")
          .insert(buildListingFromLead(lead))
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to create listing for lead:", lead.id, insertError);
          errorCount++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("valuation_leads")
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listing.id,
            status: "pushed",
          } as never)
          .eq("id", lead.id);

        if (updateError) {
          console.error("Listing created but failed to mark lead as pushed:", lead.id, updateError);
        }

        successCount++;
      }

      setIsPushing(false);
      setSelectedIds(new Set());

      if (successCount > 0) {
        sonnerToast.success(`Pushed ${successCount} lead${successCount !== 1 ? "s" : ""} to All Deals${errorCount > 0 ? ` (${errorCount} failed)` : ""}`);
      } else {
        sonnerToast.info("Nothing to push — selected leads were already pushed or not found.");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, isPushing, queryClient]
  );

  // Enrich already-pushed leads (re-enrich from their listing)
  const handleEnrichPushed = useCallback(
    async (leadIds: string[]) => {
      const leadsToEnrich = (leads || []).filter(
        (l) => leadIds.includes(l.id) && l.pushed_to_all_deals && l.pushed_listing_id
      );

      if (leadsToEnrich.length === 0) {
        sonnerToast.info("No pushed leads to enrich in selection");
        return;
      }

      const listingIds = leadsToEnrich.map((l) => l.pushed_listing_id!);
      try {
        const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
        const queued = await queueDealEnrichment(listingIds);
        sonnerToast.success(`Queued ${queued} listing${queued !== 1 ? "s" : ""} for re-enrichment`);
      } catch (err) {
        console.error("Re-enrichment queue failed:", err);
        sonnerToast.error("Failed to queue re-enrichment. Please try again.");
      }
    },
    [leads]
  );

  // Push & Enrich — pushes leads to listings then queues them in enrichment_queue
  const handlePushAndEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsPushEnriching(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);
      let pushed = 0;
      let enrichQueued = 0;
      const listingIds: string[] = [];

      for (const lead of leadsToProcess) {
        const { data: listing, error: insertError } = await supabase
          .from("listings")
          .insert({
            title: lead.business_name || lead.full_name || lead.display_name || "Valuation Lead",
            internal_company_name: lead.business_name || lead.full_name || null,
            website: lead.website || null,
            location: lead.location || null,
            revenue: lead.revenue,
            ebitda: lead.ebitda,
            deal_source: "valuation_calculator",
            status: "active",
            is_internal_deal: true,
          } as never)
          .select("id")
          .single();

        if (insertError || !listing) continue;

        listingIds.push(listing.id);

        await supabase
          .from("valuation_leads")
          .update({ pushed_to_all_deals: true, pushed_listing_id: listing.id } as never)
          .eq("id", lead.id);

        pushed++;
      }

      // Queue all pushed listings for enrichment
      for (const listingId of listingIds) {
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert({ listing_id: listingId, status: "pending", force: true } as never, {
            onConflict: "listing_id",
            ignoreDuplicates: false,
          });
        if (!error) enrichQueued++;
      }

      setIsPushEnriching(false);
      setSelectedIds(new Set());

      if (pushed > 0) {
        sonnerToast.success(`Pushed ${pushed} lead${pushed !== 1 ? "s" : ""} and queued ${enrichQueued} for enrichment`);
      } else {
        sonnerToast.info("No unpushed leads selected");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, queryClient]
  );

  // Re-Enrich — re-queues already-pushed leads in the enrichment_queue
  const handleReEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsReEnriching(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && l.pushed_to_all_deals && l.pushed_listing_id
      );

      let queued = 0;
      for (const lead of leadsToProcess) {
        if (!lead.pushed_listing_id) continue;
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert({ listing_id: lead.pushed_listing_id, status: "pending", force: true } as never, {
            onConflict: "listing_id",
            ignoreDuplicates: false,
          });
        if (!error) queued++;
      }

      setIsReEnriching(false);
      setSelectedIds(new Set());

      if (queued > 0) {
        sonnerToast.success(`Re-queued ${queued} lead${queued !== 1 ? "s" : ""} for enrichment`);
      } else {
        sonnerToast.info("No pushed leads with listing IDs found");
      }
    },
    [leads]
  );

  // Score leads
  const handleScoreLeads = useCallback(
    async (mode: "unscored" | "all") => {
      const targets = mode === "unscored"
        ? filteredLeads.filter((l) => l.lead_score == null)
        : filteredLeads;

      if (!targets.length) {
        sonnerToast.info("No leads to score");
        return;
      }

      setIsScoring(true);
      sonnerToast.info(`Scoring ${targets.length} leads...`);

      try {
        const { data, error } = await supabase.functions.invoke("calculate-valuation-lead-score", {
          body: { mode },
        });

        if (error) throw error;

        sonnerToast.success(`Scored ${data?.scored ?? targets.length} leads`);
      } catch (err) {
        console.error("Scoring failed:", err);
        sonnerToast.error("Scoring failed");
      }

      setIsScoring(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [filteredLeads, queryClient]
  );

  // KPI Stats
  const kpiStats = useMemo(() => {
    const tabLeads = activeTab === "all" ? leads || [] : (leads || []).filter((l) => l.calculator_type === activeTab);
    const timeFiltered = fromDate ? tabLeads.filter((l) => l.created_at >= fromDate) : tabLeads;

    const totalLeads = timeFiltered.length;
    const openToIntros = timeFiltered.filter((l) => l.open_to_intros === true).length;
    const exitNow = timeFiltered.filter((l) => l.exit_timing === "now").length;
    const pushedCount = timeFiltered.filter((l) => l.pushed_to_all_deals === true).length;

    return { totalLeads, openToIntros, exitNow, pushedCount };
  }, [leads, activeTab, fromDate]);

  // Summary stats
  const totalLeads = leads?.length || 0;
  const unscoredCount = leads?.filter((l) => l.lead_score == null).length || 0;

  const SortHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortColumn === column ? "text-foreground" : "text-muted-foreground/50"
        )}
      />
    </button>
  );

  const timeframes: { label: string; value: Timeframe }[] = [
    { label: "Today", value: "today" },
    { label: "7d", value: "7d" },
    { label: "14d", value: "14d" },
    { label: "30d", value: "30d" },
    { label: "90d", value: "90d" },
    { label: "All", value: "all" },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Valuation Calculator Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalLeads} total &middot; {unscoredCount} unscored
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScoring}>
                {isScoring ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-1" />
                )}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleScoreLeads("unscored")}>
                Score Unscored
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScoreLeads("all")}>
                Recalculate All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timeframe selector */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  timeframe === tf.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calculator Type Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "all"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          All Types
        </button>
        {calculatorTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === type
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {type === "general" ? "General" : type === "auto_shop" ? "Auto Shop" : type.replace(/_/g, " ")}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({(leads || []).filter((l) => l.calculator_type === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{kpiStats.totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open to Intros</p>
                <p className="text-2xl font-bold text-blue-600">{kpiStats.openToIntros}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exit Now</p>
                <p className="text-2xl font-bold text-red-600">{kpiStats.exitNow}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pushed to All Deals</p>
                <p className="text-2xl font-bold text-green-600">{kpiStats.pushedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions (selection-based) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedIds.size} selected
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <XCircle className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePushToAllDeals(Array.from(selectedIds))}
            disabled={isPushing || isPushEnriching}
            className="gap-2"
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Push to All Deals
          </Button>
          <Button
            size="sm"
            onClick={() => handlePushAndEnrich(Array.from(selectedIds))}
            disabled={isPushEnriching || isPushing}
            className="gap-2"
          >
            {isPushEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Push &amp; Enrich
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleReEnrich(Array.from(selectedIds))}
            disabled={isReEnriching}
            className="gap-2"
          >
            {isReEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Re-Enrich Pushed
          </Button>
        </div>
      )}

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHeader column="display_name">Lead</SortHeader>
                  </TableHead>
                  {activeTab === "all" && (
                    <TableHead>Calculator</TableHead>
                  )}
                  <TableHead>
                    <SortHeader column="industry">Industry</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="revenue">Revenue</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="ebitda">EBITDA</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="valuation">Valuation</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="exit_timing">Exit</SortHeader>
                  </TableHead>
                  <TableHead className="text-center">Intros</TableHead>
                  <TableHead>
                    <SortHeader column="quality">Quality</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="score">Score</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="created_at">Date</SortHeader>
                  </TableHead>
                  <TableHead>
                    <SortHeader column="pushed">Status</SortHeader>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={activeTab === "all" ? 14 : 13}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No valuation calculator leads yet</p>
                      <p className="text-sm mt-1">
                        Leads will appear here when submitted through SourceCo calculators.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={cn(
                        "transition-colors",
                        lead.pushed_to_all_deals && "bg-green-50/60 hover:bg-green-50"
                      )}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-[40px]"
                      >
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm truncate max-w-[200px]">
                            {extractBusinessName(lead)}
                          </span>
                          {lead.full_name && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {lead.full_name}
                            </span>
                          )}
                          {lead.email && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {lead.email}
                            </span>
                          )}
                          {inferWebsite(lead) && (
                            <span className="text-xs text-blue-500 truncate max-w-[200px]">
                              {inferWebsite(lead)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {activeTab === "all" && (
                        <TableCell>{calculatorBadge(lead.calculator_type)}</TableCell>
                      )}
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
                          {lead.industry || "\u2014"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lead.revenue != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.revenue)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.ebitda != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.ebitda)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.valuation_low != null && lead.valuation_high != null ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatCompactCurrency(lead.valuation_low)}–{formatCompactCurrency(lead.valuation_high)}
                          </span>
                        ) : lead.valuation_mid != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.valuation_mid)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>{exitTimingBadge(lead.exit_timing)}</TableCell>
                      <TableCell className="text-center">
                        {lead.open_to_intros === true ? (
                          <span className="text-emerald-600 font-bold text-lg leading-none">✓</span>
                        ) : lead.open_to_intros === false ? (
                          <span className="text-muted-foreground text-base">—</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>{qualityBadge(lead.quality_label)}</TableCell>
                      <TableCell className="text-center">
                        {lead.lead_score != null ? (
                          <span className={cn(
                            "text-sm font-medium px-2 py-0.5 rounded tabular-nums",
                            scorePillClass(lead.lead_score)
                          )}>
                            {lead.lead_score}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(lead.created_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {lead.pushed_to_all_deals ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Pushed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                              {lead.status || "new"}
                            </Badge>
                          )}
                        </div>
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
                              onClick={() => handlePushToAllDeals([lead.id])}
                              disabled={!!lead.pushed_to_all_deals}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Push to All Deals
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePushAndEnrich([lead.id])}
                              disabled={!!lead.pushed_to_all_deals}
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Push &amp; Enrich
                            </DropdownMenuItem>
                            {lead.pushed_to_all_deals && lead.pushed_listing_id && (
                              <DropdownMenuItem
                                onClick={() => handleReEnrich([lead.id])}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Re-Enrich
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("valuation_leads")
                                  .update({ excluded: true, exclusion_reason: "Manual exclusion" } as never)
                                  .eq("id", lead.id);
                                if (error) {
                                  sonnerToast.error("Failed to exclude lead");
                                } else {
                                  sonnerToast.success("Lead excluded");
                                  queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                                }
                              }}
                              className="text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Exclude Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filteredLeads.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} leads
          {filteredLeads.length !== totalLeads && ` (filtered from ${totalLeads})`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={safePage <= 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-3 tabular-nums flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
