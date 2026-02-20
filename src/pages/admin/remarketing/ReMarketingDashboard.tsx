import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { DealSourceBadge } from "@/components/remarketing/DealSourceBadge";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  ArrowUpRight,
  Zap,
  Clock,
} from "lucide-react";

// ─── Types ───

type Timeframe = "today" | "7d" | "14d" | "30d" | "90d" | "all";

interface DealRow {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  deal_source: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  deal_total_score: number | null;
  deal_owner_id: string | null;
  enrichment_status: string | null;
  enriched_at: string | null;
  created_at: string;
  revenue: number | null;
  ebitda: number | null;
  category: string | null;
  address_state: string | null;
  status: string | null;
}

// ─── Helpers ───

function getFromDate(tf: Timeframe): string | null {
  if (tf === "all") return null;
  const now = new Date();
  const days = tf === "today" ? 1 : tf === "7d" ? 7 : tf === "14d" ? 14 : tf === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function scorePillClass(score: number | null): string {
  if (score == null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  if (score >= 20) return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-600";
}

function isAllDealVisible(d: DealRow): boolean {
  if ((d as any).remarketing_status === "archived" || (d as any).remarketing_status === "excluded") return false;
  if (d.status === "archived" || d.status === "inactive") return false;
  const src = d.deal_source;
  if (src === "captarget" || src === "gp_partners" || src === "valuation_calculator") return d.pushed_to_all_deals === true;
  return true;
}

function initials(first: string | null, last: string | null): string {
  return `${(first || "?")[0]}${(last || "")[0] || ""}`.toUpperCase();
}

// ─── Week helpers for chart ───

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Source colors ───

const SOURCE_COLORS: Record<string, string> = {
  captarget: "#2563eb",
  gp_partners: "#ea580c",
  referral: "#7c3aed",
  marketplace: "#16a34a",
  valuation_calculator: "#10b981",
  manual: "#94a3b8",
};

const SOURCE_LABELS: Record<string, string> = {
  captarget: "CapTarget",
  gp_partners: "GP Partners",
  referral: "Referral",
  marketplace: "Marketplace",
  valuation_calculator: "Calculator",
  manual: "Manual",
};

// ─── Component ───

const ReMarketingDashboard = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const fromDate = getFromDate(timeframe);

  const { data: adminProfiles } = useAdminProfiles();

  // ── Master query: fetch all listings with needed columns (paginated to avoid 1000-row limit) ──
  const { data: allDeals, isLoading: dealsLoading } = useQuery({
    queryKey: ["dashboard", "all-deals"],
    queryFn: async () => {
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      const allData: DealRow[] = [];

      while (hasMore) {
        const { data, error } = await supabase
          .from("listings")
          .select("id, title, internal_company_name, deal_source, pushed_to_all_deals, pushed_to_all_deals_at, deal_total_score, deal_owner_id, enrichment_status, enriched_at, created_at, revenue, ebitda, category, address_state, status, remarketing_status")
          .in("remarketing_status", ["active"])
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...(data as unknown as DealRow[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    staleTime: 30_000,
  });

  // ── Buyer universes ──
  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ["dashboard", "universes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyer_universes")
        .select("id, name")
        .eq("archived", false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // ── Scores per universe ──
  const { data: scoreData } = useQuery({
    queryKey: ["dashboard", "scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_scores")
        .select("universe_id, status");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // ── Buyers per universe ──
  const { data: buyerData } = useQuery({
    queryKey: ["dashboard", "buyers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("universe_id")
        .eq("archived", false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // ── Computed metrics ──
  const metrics = useMemo(() => {
    if (!allDeals) return null;

    const allVisible = allDeals.filter(isAllDealVisible);
    const ct = allDeals.filter(d => d.deal_source === "captarget");
    const gp = allDeals.filter(d => d.deal_source === "gp_partners");
    const other = allDeals.filter(d => !["captarget", "gp_partners"].includes(d.deal_source || ""));

    const inPeriod = (d: DealRow) => {
      if (!fromDate) return true;
      return d.created_at >= fromDate;
    };
    const pushedInPeriod = (d: DealRow) => {
      if (!fromDate) return d.pushed_to_all_deals === true;
      return d.pushed_to_all_deals === true && d.pushed_to_all_deals_at != null && d.pushed_to_all_deals_at >= fromDate;
    };

    // Card 1 - All Deals
    const allDealsNewInPeriod = allVisible.filter(d => {
      if (!fromDate) return true;
      const src = d.deal_source;
      if (src === "captarget" || src === "gp_partners") {
        return d.pushed_to_all_deals_at != null && d.pushed_to_all_deals_at >= fromDate;
      }
      return d.created_at >= fromDate;
    });

    // Card 2 - CapTarget
    const ctNew = ct.filter(inPeriod);
    const ctPushed = ct.filter(d => d.pushed_to_all_deals === true);

    // Card 3 - GP
    const gpNew = gp.filter(inPeriod);
    const gpPushed = gp.filter(d => d.pushed_to_all_deals === true);

    // Card 4 - Other
    const marketplace = other.filter(d => d.deal_source === "marketplace");
    const manual = other.filter(d => !d.deal_source || d.deal_source === "manual");

    // Card 5 - Enriched
    const enriched = allDeals.filter(d => d.enrichment_status === "enriched" || (d.enriched_at && !d.enrichment_status));
    const pending = allDeals.filter(d => d.enrichment_status === "pending");
    const failed = allDeals.filter(d => d.enrichment_status === "failed");

    // CT panel
    const ctScored = ct.filter(d => d.deal_total_score != null);
    const ctAvg = ctScored.length > 0 ? Math.round(ctScored.reduce((s, d) => s + (d.deal_total_score || 0), 0) / ctScored.length) : 0;
    const ctApprovedInPeriod = ct.filter(pushedInPeriod);

    // GP panel
    const gpScored = gp.filter(d => d.deal_total_score != null);
    const gpAvg = gpScored.length > 0 ? Math.round(gpScored.reduce((s, d) => s + (d.deal_total_score || 0), 0) / gpScored.length) : 0;
    const gpApprovedInPeriod = gp.filter(pushedInPeriod);

    // New by source
    const newInPeriod = allDeals.filter(inPeriod);
    const bySource: Record<string, number> = {};
    newInPeriod.forEach(d => {
      const src = d.deal_source || "manual";
      bySource[src] = (bySource[src] || 0) + 1;
    });

    // Team assignments
    const ownerCounts: Record<string, { total: number; enriched: number; scored: number }> = {};
    allVisible.forEach(d => {
      const oid = d.deal_owner_id || "__unassigned";
      if (!ownerCounts[oid]) ownerCounts[oid] = { total: 0, enriched: 0, scored: 0 };
      ownerCounts[oid].total++;
      if (d.enrichment_status === "enriched" || d.enriched_at) ownerCounts[oid].enriched++;
      if (d.deal_total_score != null) ownerCounts[oid].scored++;
    });

    // Top deals
    const topDeals = allDeals
      .filter(d => inPeriod(d) && d.deal_total_score != null)
      .sort((a, b) => (b.deal_total_score || 0) - (a.deal_total_score || 0))
      .slice(0, 8);

    // Score distribution
    const scored = allDeals.filter(d => d.deal_total_score != null);
    const unscored = allDeals.length - scored.length;
    const scoreBuckets = [
      { label: "80–100", tag: "Top Tier", color: "#16a34a", count: scored.filter(d => d.deal_total_score! >= 80).length },
      { label: "60–79", tag: "Strong", color: "#2563eb", count: scored.filter(d => d.deal_total_score! >= 60 && d.deal_total_score! < 80).length },
      { label: "40–59", tag: "Average", color: "#ca8a04", count: scored.filter(d => d.deal_total_score! >= 40 && d.deal_total_score! < 60).length },
      { label: "20–39", tag: "Below Avg", color: "#ea580c", count: scored.filter(d => d.deal_total_score! >= 20 && d.deal_total_score! < 40).length },
      { label: "0–19", tag: "Low", color: "#94a3b8", count: scored.filter(d => d.deal_total_score! < 20).length + unscored },
    ];

    // Source breakdown (all deals visible)
    const allSourceCounts: Record<string, number> = {};
    allVisible.forEach(d => {
      const src = d.deal_source || "manual";
      allSourceCounts[src] = (allSourceCounts[src] || 0) + 1;
    });

    // Weekly chart data (always last 8 weeks)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const weeklyData: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      const ws = new Date();
      ws.setDate(ws.getDate() - (7 - i) * 7);
      const key = getISOWeekStart(ws).toISOString().slice(0, 10);
      weeklyData[key] = 0;
    }
    allDeals.forEach(d => {
      let addedDate: string | null = null;
      if (d.deal_source === "captarget" || d.deal_source === "gp_partners") {
        if (d.pushed_to_all_deals && d.pushed_to_all_deals_at) addedDate = d.pushed_to_all_deals_at;
      } else {
        addedDate = d.created_at;
      }
      if (!addedDate || addedDate < eightWeeksAgo.toISOString()) return;
      const weekKey = getISOWeekStart(new Date(addedDate)).toISOString().slice(0, 10);
      if (weekKey in weeklyData) weeklyData[weekKey]++;
    });
    const weeks = Object.entries(weeklyData).sort(([a], [b]) => a.localeCompare(b));

    // Recent activity
    const recentActivity = allDeals
      .map(d => {
        const events: { date: string; type: string; name: string; source: string | null }[] = [];
        events.push({ date: d.created_at, type: "created", name: d.internal_company_name || d.title || "Unknown", source: d.deal_source });
        if (d.pushed_to_all_deals && d.pushed_to_all_deals_at) {
          events.push({ date: d.pushed_to_all_deals_at, type: "pushed", name: d.internal_company_name || d.title || "Unknown", source: d.deal_source });
        }
        return events;
      })
      .flat()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return {
      allVisible, allDealsNewInPeriod,
      ct, ctNew, ctPushed, ctAvg, ctApprovedInPeriod,
      gp, gpNew, gpPushed, gpAvg, gpApprovedInPeriod,
      other, marketplace, manual,
      enriched, pending, failed,
      bySource, ownerCounts, topDeals, scoreBuckets,
      allSourceCounts, weeks, recentActivity,
      totalScored: scored.length,
    };
  }, [allDeals, fromDate]);

  // ── Universe metrics ──
  const universeMetrics = useMemo(() => {
    if (!universes || !scoreData || !buyerData) return null;
    return universes.map(u => {
      const scores = scoreData.filter(s => s.universe_id === u.id);
      const approved = scores.filter(s => s.status === "approved").length;
      const buyers = buyerData.filter(b => (b as any).universe_id === u.id).length;
      return { ...u, totalScored: scores.length, approved, buyers };
    }).sort((a, b) => b.approved - a.approved);
  }, [universes, scoreData, buyerData]);

  const TF_OPTIONS: { key: Timeframe; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7d" },
    { key: "14d", label: "14d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
  ];

  const loading = dealsLoading;

  // ── SVG Line Chart ──
  const WeeklyChart = () => {
    if (!metrics) return <Skeleton className="h-48 w-full" />;
    const { weeks } = metrics;
    const values = weeks.map(([, v]) => v);
    const max = Math.max(...values, 1);
    const total = values.reduce((s, v) => s + v, 0);

    const W = 440;
    const H = 160;
    const PL = 30;
    const PR = 10;
    const PT = 25;
    const PB = 30;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    const points = values.map((v, i) => ({
      x: PL + (i / (values.length - 1 || 1)) * chartW,
      y: PT + chartH - (v / max) * chartH,
      v,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1]?.x ?? PL},${PT + chartH} L${PL},${PT + chartH} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
      y: PT + chartH - pct * chartH,
      label: Math.round(pct * max),
    }));

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Deals Added to All Deals</h3>
          <span className="text-xs text-gray-400">{total} total (8 weeks)</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {gridLines.map(g => (
            <g key={g.y}>
              <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PL - 4} y={g.y + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{g.label}</text>
            </g>
          ))}
          <path d={areaPath} fill="url(#chartGrad)" />
          <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#2563eb" strokeWidth="2" />
              <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-gray-700 font-medium" fontSize="9">{p.v}</text>
              <text x={p.x} y={PT + chartH + 14} textAnchor="middle" className="fill-gray-400" fontSize="8">
                {formatWeekLabel(new Date(weeks[i][0]))}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remarketing Dashboard</h1>
          <p className="text-sm text-muted-foreground">Deal pipeline overview</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
          {TF_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setTimeframe(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeframe === opt.key
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 1: Headline Metric Cards */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : metrics && (
        <div className="grid gap-3 md:grid-cols-5">
          {/* All Deals */}
          <div className="rounded-xl border bg-gray-900 text-white px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">All Deals</p>
            <p className="text-2xl font-bold mt-1">{metrics.allVisible.length}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">+{metrics.allDealsNewInPeriod.length} in period</p>
          </div>
          {/* CapTarget */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">CapTarget</p>
            <p className="text-2xl font-bold mt-1">{metrics.ct.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">+{metrics.ctNew.length} new · {metrics.ctPushed.length} pushed</p>
          </div>
          {/* GP Partners */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">GP Partners</p>
            <p className="text-2xl font-bold mt-1">{metrics.gp.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">+{metrics.gpNew.length} new · {metrics.gpPushed.length} pushed</p>
          </div>
          {/* Referral / Other */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Referral / Other</p>
            <p className="text-2xl font-bold mt-1">{metrics.other.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{metrics.marketplace.length} marketplace · {metrics.manual.length} manual</p>
          </div>
          {/* Enriched */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Enriched</p>
            <p className="text-2xl font-bold mt-1">{metrics.enriched.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{metrics.pending.length} pending · {metrics.failed.length} failed</p>
          </div>
        </div>
      )}

      {/* ROW 2: Weekly Chart + CT + GP */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Weekly line chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          {loading ? <Skeleton className="h-48 w-full" /> : <WeeklyChart />}
        </div>

        {/* CapTarget panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">CapTarget</h3>
          {loading ? <Skeleton className="h-32 w-full" /> : metrics && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{metrics.ctNew.length}</p>
                  <p className="text-[10px] text-gray-500 uppercase">New Deals</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{metrics.ctApprovedInPeriod.length}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{metrics.ctAvg}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Avg Score</p>
                </div>
              </div>
              <div className="border-t mt-4 pt-3 flex items-center justify-between text-xs text-gray-500">
                <span>{metrics.ct.length} total CapTarget deals</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${scorePillClass(metrics.ctAvg)}`}>{metrics.ctAvg}</span>
              </div>
            </>
          )}
        </div>

        {/* GP Partners panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">GP Partners</h3>
          {loading ? <Skeleton className="h-32 w-full" /> : metrics && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{metrics.gpNew.length}</p>
                  <p className="text-[10px] text-gray-500 uppercase">New Deals</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{metrics.gpApprovedInPeriod.length}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{metrics.gpAvg}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Avg Score</p>
                </div>
              </div>
              <div className="border-t mt-4 pt-3 flex items-center justify-between text-xs text-gray-500">
                <span>{metrics.gp.length} total GP Partners deals</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${scorePillClass(metrics.gpAvg)}`}>{metrics.gpAvg}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ROW 3: New by Source + Team Assignments */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* New Deals by Source */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">New Deals by Source</h3>
            <span className="text-xs text-gray-400">{loading ? "..." : Object.values(metrics?.bySource || {}).reduce((a, b) => a + b, 0)} added</span>
          </div>
          {loading ? <Skeleton className="h-32 w-full" /> : metrics && (() => {
            const entries = Object.entries(metrics.bySource).sort(([, a], [, b]) => b - a);
            const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
            return (
              <div>
                {/* Stacked bar */}
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-4">
                  {entries.map(([src, count]) => (
                    <div
                      key={src}
                      style={{ width: `${(count / total) * 100}%`, backgroundColor: SOURCE_COLORS[src] || "#94a3b8" }}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {entries.map(([src, count]) => (
                    <div key={src} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[src] || "#94a3b8" }} />
                        <span className="text-gray-700">{SOURCE_LABELS[src] || src}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{Math.round((count / total) * 100)}%</span>
                        <span className="font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Team Assignments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Team Assignments</h3>
            <span className="text-xs text-gray-400">{metrics?.allVisible.length || 0} deals</span>
          </div>
          {loading ? <Skeleton className="h-32 w-full" /> : metrics && (() => {
            const entries = Object.entries(metrics.ownerCounts)
              .sort(([aId, a], [bId, b]) => {
                if (aId === "__unassigned") return 1;
                if (bId === "__unassigned") return -1;
                return b.total - a.total;
              });
            return (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {entries.map(([oid, counts]) => {
                  const profile = oid !== "__unassigned" && adminProfiles ? adminProfiles[oid] : null;
                  const name = profile ? profile.displayName : "Unassigned";
                  const fi = profile ? initials(profile.first_name, profile.last_name) : "?";
                  return (
                    <div key={oid} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${oid === "__unassigned" ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-700"}`}>
                        {fi}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                        <p className="text-[11px] text-gray-500">{counts.enriched} enriched · {counts.scored} scored</p>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{counts.total}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ROW 4: Top Deals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Top Deals Added</h3>
          <span className="text-xs text-gray-400">Highest scored in period</span>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : metrics && metrics.topDeals.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No scored deals in this period</p>
          </div>
        ) : metrics && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b">
                  <th className="pb-2 pr-2 w-8">#</th>
                  <th className="pb-2 pr-3">Company</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Revenue</th>
                  <th className="pb-2 pr-3 text-right">EBITDA</th>
                  <th className="pb-2 pr-3 text-center">Score</th>
                  <th className="pb-2 pr-3">State</th>
                  <th className="pb-2 text-right">Added</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topDeals.map((deal, i) => (
                  <tr key={deal.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <Link to={`/admin/remarketing/deals/${deal.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {deal.internal_company_name || deal.title || "—"}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3"><DealSourceBadge source={deal.deal_source} /></td>
                    <td className="py-2.5 pr-3 text-gray-600 truncate max-w-[120px]">{deal.category || "—"}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(deal.revenue)}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-700">{formatCurrency(deal.ebitda)}</td>
                    <td className="py-2.5 pr-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${scorePillClass(deal.deal_total_score)}`}>
                        {deal.deal_total_score}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600">{deal.address_state || "—"}</td>
                    <td className="py-2.5 text-right text-gray-500 text-xs">
                      {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ROW 5: Score Distribution + Universes + Source Breakdown + Activity */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Deals by Score</h3>
            <span className="text-xs text-gray-400">{metrics?.totalScored || 0} scored</span>
          </div>
          {loading ? <Skeleton className="h-40 w-full" /> : metrics && (
            <div className="space-y-3">
              {metrics.scoreBuckets.map(b => {
                const maxCount = Math.max(...metrics.scoreBuckets.map(x => x.count), 1);
                return (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                        <span className="text-gray-600">{b.label}</span>
                        <span className="text-gray-400">{b.tag}</span>
                      </div>
                      <span className="font-medium text-gray-800">{b.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(b.count / maxCount) * 100}%`, backgroundColor: b.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buyer Universes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Buyer Universes</h3>
            <span className="text-xs text-gray-400">{universes?.length || 0} active</span>
          </div>
          {universesLoading ? <Skeleton className="h-40 w-full" /> : universeMetrics && universeMetrics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active universes</p>
          ) : universeMetrics && (
            <div className="space-y-3 max-h-52 overflow-y-auto">
              {universeMetrics.map(u => (
                <div key={u.id} className="p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <Link to={`/admin/remarketing/universes/${u.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate">
                      {u.name}
                    </Link>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{u.buyers} buyers</span>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">{u.totalScored} scored</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">{u.approved} approved</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Deals by Source */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">All Deals by Source</h3>
            <span className="text-xs text-gray-400">{metrics?.allVisible.length || 0} total</span>
          </div>
          {loading ? <Skeleton className="h-40 w-full" /> : metrics && (() => {
            const entries = Object.entries(metrics.allSourceCounts).sort(([, a], [, b]) => b - a);
            const maxCount = Math.max(...entries.map(([, v]) => v), 1);
            return (
              <div>
                <div className="space-y-2.5">
                  {entries.map(([src, count]) => (
                    <div key={src}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[src] || "#94a3b8" }} />
                          <span className="text-gray-700">{SOURCE_LABELS[src] || src}</span>
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: SOURCE_COLORS[src] || "#94a3b8" }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Enrichment sub-section */}
                <div className="border-t mt-4 pt-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Enrichment</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">{metrics.enriched.length} Enriched</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">{metrics.pending.length} Pending</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200">{metrics.failed.length} Failed</Badge>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Recent Activity</h3>
            <Clock className="h-3.5 w-3.5 text-gray-400" />
          </div>
          {loading ? <Skeleton className="h-40 w-full" /> : metrics && metrics.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
          ) : metrics && (
            <div className="space-y-3">
              {metrics.recentActivity.map((ev, i) => {
                const iconColor = ev.type === "pushed" ? "bg-green-100 text-green-600"
                  : ev.source === "captarget" ? "bg-blue-100 text-blue-600"
                  : ev.source === "gp_partners" ? "bg-orange-100 text-orange-600"
                  : ev.source === "referral" ? "bg-purple-100 text-purple-600"
                  : "bg-gray-100 text-gray-600";
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}>
                      {ev.type === "pushed" ? <ArrowUpRight className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate">
                        {ev.type === "pushed" ? "Pushed to All Deals" : "Deal created"}: <span className="font-medium">{ev.name}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <DealSourceBadge source={ev.source} />
                        <span className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(ev.date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReMarketingDashboard;
