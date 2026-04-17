/**
 * ReMarketingDashboardV2.tsx
 *
 * Thin shell for the rebuilt Remarketing Dashboard. Owns:
 *   • Timeframe filter
 *   • Persistent 6-KPI hero strip (shared across every tab)
 *   • Tab routing — tab content comes from dashboard-tabs/* components
 *
 * Each tab component fetches its own data (TanStack Query dedupes where the
 * same queryKey is reused, so calling useDashboardData in both this shell and
 * the Deal Supply tab costs nothing extra).
 *
 * V1 (ReMarketingDashboard.tsx) is kept on disk for rollback. Swap the lazy
 * imports in AdminDashboard.tsx and App.tsx to revert.
 */
import { useState, useMemo, Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, DollarSign, Send, Target, Trophy, TrendingUp } from 'lucide-react';

import { DashboardFilters } from './DashboardFilters';
import { useDashboardData, formatCurrency, type Timeframe } from './useDashboardData';
import { TabErrorBoundary } from './dashboard-tabs/TabErrorBoundary';

// Lazy-load tab bodies so the dashboard initial bundle only includes the
// currently-active tab. Each tab is around 300-500 lines; laziness keeps
// initial paint fast and defers the heavier hooks until the user navigates.
const DealSupplyTab = lazy(() =>
  import('./dashboard-tabs/DealSupplyTab').then((m) => ({ default: m.DealSupplyTab })),
);
const OutreachTab = lazy(() =>
  import('./dashboard-tabs/OutreachTab').then((m) => ({ default: m.OutreachTab })),
);
const PipelineTab = lazy(() =>
  import('./dashboard-tabs/PipelineTab').then((m) => ({ default: m.PipelineTab })),
);
const BuyersTab = lazy(() =>
  import('./dashboard-tabs/BuyersTab').then((m) => ({ default: m.BuyersTab })),
);
const IntrosTab = lazy(() =>
  import('./dashboard-tabs/IntrosTab').then((m) => ({ default: m.IntrosTab })),
);
const TeamTab = lazy(() =>
  import('./dashboard-tabs/TeamTab').then((m) => ({ default: m.TeamTab })),
);

const TabFallback = () => (
  <div className="space-y-3">
    <Skeleton className="h-20 rounded-xl" />
    <Skeleton className="h-40 rounded-xl" />
    <Skeleton className="h-48 rounded-xl" />
  </div>
);

// ─── Hero strip types ──────────────────────────────────────────────────────

interface HeroMetric {
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}

function formatInt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString();
}

function formatPercent(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(1)}%`;
}

const ReMarketingDashboardV2 = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [activeTab, setActiveTab] = useState('supply');

  // Call this in the shell for the hero strip. Deal Supply tab also calls it;
  // TanStack Query shares the result via queryKey so there's no double-fetch.
  const { loading, cards, outreachStats } = useDashboardData(timeframe);

  // ─── Hero strip metrics ────────────────────────────────────────────────
  const heroMetrics = useMemo<HeroMetric[]>(() => {
    const pipelineEbitda = cards?.total_pipeline_ebitda ?? 0;
    const dealsAdded = cards?.all_new_in_period ?? 0;
    const ctNew = cards?.ct_new ?? 0;
    const gpNew = cards?.gp_new ?? 0;
    const scNew = cards?.sc_new ?? 0;

    const emailsSent = outreachStats?.emails_sent ?? 0;
    const linkedinSent = outreachStats?.linkedin_sent ?? 0;
    const callsMade = outreachStats?.calls_made ?? 0;
    const totalOutreach = emailsSent + linkedinSent + callsMade;

    const emailsReplied = outreachStats?.emails_replied ?? 0;
    const linkedinReplied = outreachStats?.linkedin_replied ?? 0;
    const replyDenominator = emailsSent + linkedinSent;
    const replyRate =
      replyDenominator > 0 ? formatPercent(emailsReplied + linkedinReplied, replyDenominator) : '—';

    const diligencePlusCount = cards?.deals_in_diligence_plus ?? 0;
    const diligencePlusEbitda = cards?.ebitda_in_diligence_plus ?? 0;

    const closedWonCount = cards?.closed_won_count ?? 0;
    const closedWonEbitda = cards?.closed_won_ebitda ?? 0;

    return [
      {
        label: 'Active Pipeline',
        value: formatCurrency(pipelineEbitda),
        subtitle: `${formatInt(cards?.all_visible)} deals`,
        highlight: true,
        icon: <DollarSign className="h-4 w-4" />,
      },
      {
        label: 'Deals Added',
        value: `+${formatInt(dealsAdded)}`,
        subtitle: `${ctNew} CT · ${gpNew} GP · ${scNew} SourceCo`,
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        label: 'Outreach Sent',
        value: formatInt(totalOutreach),
        subtitle: `${formatInt(emailsSent)} email · ${formatInt(callsMade)} call · ${formatInt(linkedinSent)} LI`,
        icon: <Send className="h-4 w-4" />,
      },
      {
        label: 'Reply Rate',
        value: replyRate,
        subtitle: `${formatInt(emailsReplied + linkedinReplied)} replies`,
        icon: <Target className="h-4 w-4" />,
      },
      {
        label: 'In Diligence+',
        value: formatInt(diligencePlusCount),
        subtitle: `${formatCurrency(diligencePlusEbitda)} EBITDA`,
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        label: 'Closed Won',
        value: formatInt(closedWonCount),
        subtitle: `${formatCurrency(closedWonEbitda)} EBITDA`,
        icon: <Trophy className="h-4 w-4" />,
      },
    ];
  }, [cards, outreachStats]);

  return (
    <div className="p-6 space-y-5 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remarketing Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Deal supply, outreach, pipeline, and team performance
          </p>
        </div>
        <DashboardFilters timeframe={timeframe} onTimeframeChange={setTimeframe} />
      </div>

      {/* Persistent Hero Strip — 6 KPIs */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {heroMetrics.map((m) => (
            <div
              key={m.label}
              className={`rounded-xl border px-4 py-3.5 ${
                m.highlight ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-[10px] uppercase tracking-widest ${
                    m.highlight ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {m.label}
                </p>
                {m.icon && (
                  <span className={m.highlight ? 'text-gray-500' : 'text-gray-400'}>{m.icon}</span>
                )}
              </div>
              <p className="text-2xl font-bold mt-1">{m.value}</p>
              <p
                className={`text-[11px] mt-0.5 ${m.highlight ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {m.subtitle}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="bg-white border rounded-lg p-1 h-auto">
          <TabsTrigger value="supply" className="text-sm">
            Deal Supply
          </TabsTrigger>
          <TabsTrigger value="outreach" className="text-sm">
            Outreach
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-sm">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="buyers" className="text-sm">
            Buyers
          </TabsTrigger>
          <TabsTrigger value="intros" className="text-sm">
            Introductions
          </TabsTrigger>
          <TabsTrigger value="team" className="text-sm">
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-0">
          <TabErrorBoundary tabLabel="Deal Supply">
            <Suspense fallback={<TabFallback />}>
              <DealSupplyTab timeframe={timeframe} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="outreach" className="mt-0">
          <TabErrorBoundary tabLabel="Outreach">
            <Suspense fallback={<TabFallback />}>
              <OutreachTab timeframe={timeframe} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-0">
          <TabErrorBoundary tabLabel="Pipeline">
            <Suspense fallback={<TabFallback />}>
              <PipelineTab timeframe={timeframe} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="buyers" className="mt-0">
          <TabErrorBoundary tabLabel="Buyers">
            <Suspense fallback={<TabFallback />}>
              <BuyersTab />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="intros" className="mt-0">
          <TabErrorBoundary tabLabel="Introductions">
            <Suspense fallback={<TabFallback />}>
              <IntrosTab timeframe={timeframe} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="team" className="mt-0">
          <TabErrorBoundary tabLabel="Team">
            <Suspense fallback={<TabFallback />}>
              <TeamTab timeframe={timeframe} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReMarketingDashboardV2;
