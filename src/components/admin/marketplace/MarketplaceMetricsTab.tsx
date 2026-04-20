import { useCallback, useMemo, useState } from 'react';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  format,
} from 'date-fns';
import {
  UserPlus,
  Store,
  LineChart,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Briefcase,
  MessageSquare,
  Video,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import {
  useMarketplaceMetricsWithComparison,
  type MarketplaceMetrics,
  type MarketplaceMetricsRange,
} from '@/hooks/admin/use-marketplace-metrics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DashboardErrorBanner } from '@/components/common/DashboardErrorBanner';

// ── Timeline presets ──

type TimelinePreset = 'today' | '7d' | '30d' | 'mtd' | 'qtd' | 'ytd' | '12mo' | 'custom';

const PRESET_OPTIONS: Array<{ value: TimelinePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12mo', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];

function rangeForPreset(
  preset: TimelinePreset,
  customFrom?: string,
  customTo?: string,
): MarketplaceMetricsRange {
  if (preset === 'custom' && customFrom && customTo) {
    return {
      from: startOfDay(new Date(customFrom)).toISOString(),
      to: endOfDay(new Date(customTo)).toISOString(),
    };
  }
  const now = new Date();
  const to = endOfDay(now).toISOString();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to };
    case '7d':
      return { from: startOfDay(subDays(now, 6)).toISOString(), to };
    case '30d':
      return { from: startOfDay(subDays(now, 29)).toISOString(), to };
    case 'mtd':
      return { from: startOfMonth(now).toISOString(), to };
    case 'qtd':
      return { from: startOfQuarter(now).toISOString(), to };
    case 'ytd':
      return { from: startOfYear(now).toISOString(), to };
    case '12mo':
      return { from: startOfDay(subDays(now, 365)).toISOString(), to };
    default:
      return { from: startOfDay(subDays(now, 29)).toISOString(), to };
  }
}

// ── Formatters ──

function fmtCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

// ── Delta badge ──

function DeltaBadge({
  current,
  previous,
  suffix = '',
}: {
  current: number;
  previous: number;
  suffix?: string;
}) {
  if (previous === 0 && current === 0) return null;
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(0)}%{suffix}
    </span>
  );
}

// ── KPI Card with delta ──

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: { current: number; previous: number };
}) {
  return (
    <div className="border border-border/50 rounded-lg p-6 bg-card hover:border-border transition-all">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-semibold tracking-tight">{value}</span>
        {delta && (
          <DeltaBadge current={delta.current} previous={delta.previous} suffix=" vs prior" />
        )}
      </div>
      {sublabel && <p className="text-xs text-muted-foreground/70">{sublabel}</p>}
    </div>
  );
}

// ── Stat card ──

function SmallStat({
  label,
  value,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: { current: number; previous: number };
}) {
  return (
    <div className="flex items-start gap-3 border border-border/50 rounded-lg p-4 bg-card">
      <Icon className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground/70 uppercase tracking-wide">{label}</div>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {delta && <DeltaBadge current={delta.current} previous={delta.previous} />}
        </div>
      </div>
    </div>
  );
}

// ── Bar breakdown ──

function BreakdownList({
  rows,
  emptyLabel,
}: {
  rows: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground/70 py-4">{emptyLabel}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground truncate pr-2">{row.label}</span>
            <span className="text-muted-foreground tabular-nums flex-shrink-0">
              {fmtNum(row.count)}
            </span>
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground/70 rounded-full transition-all"
              style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Monthly trend chart (pure CSS, no recharts dependency) ──

function TrendChart({
  data,
  label,
}: {
  data: Array<{ month: string; value: number }>;
  label: string;
}) {
  if (data.length === 0)
    return <p className="text-sm text-muted-foreground/70 py-4">No data for this period</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">{label}</h4>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-muted-foreground tabular-nums">{d.value}</span>
            <div
              className="w-full bg-foreground/70 rounded-t transition-all"
              style={{ height: `${(d.value / max) * 90}px` }}
            />
            <span className="text-[9px] text-muted-foreground/60 truncate w-full text-center">
              {d.month.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CSV Export ──

function exportMetricsCSV(metrics: MarketplaceMetrics, rangeLabel: string) {
  const rows = [
    ['Marketplace Metrics', rangeLabel],
    [],
    ['Metric', 'Value'],
    ['New Signups', metrics.newSignups],
    ['Users Approved', metrics.usersApproved],
    ['Users Rejected', metrics.usersRejected],
    ['Users Pending', metrics.usersPending],
    [],
    ['Deals Added', metrics.dealsAdded],
    ['EBITDA Added', metrics.ebitdaAdded],
    ['Revenue Added', metrics.revenueAdded],
    [],
    ['Connection Requests Created', metrics.connectionRequestsCreated],
    ['Connection Requests Approved', metrics.connectionRequestsApproved],
    ['Connection Requests Rejected', metrics.connectionRequestsRejected],
    ['Connection Requests Pending', metrics.connectionRequestsPending],
    ['Requests per Deal', metrics.connectionRequestsPerDeal.toFixed(2)],
    [],
    ['Meetings Held', metrics.meetingsHeld],
    ['Meeting Minutes', metrics.meetingMinutes],
    [],
    ['--- Deals by Status ---'],
    ...metrics.dealsByStatus.map((d) => [d.status, d.count]),
    [],
    ['--- Deals by Industry ---'],
    ...metrics.dealsByIndustry.map((d) => [d.industry, d.count]),
    [],
    ['--- Monthly Trend ---'],
    ['Month', 'Signups', 'Deals', 'Connections', 'Meetings'],
    ...metrics.monthlyTrend.map((t) => [t.month, t.signups, t.deals, t.connections, t.meetings]),
    [],
    ['--- Zero-Request Deals ---'],
    ['Name', 'Industry', 'Created'],
    ...metrics.zeroRequestDeals.map((d) => [d.name, d.industry || '', d.created_at.slice(0, 10)]),
  ];

  const csv = rows.map((r) => (Array.isArray(r) ? r.join(',') : r)).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marketplace-metrics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Loading skeleton ──

function LoadingGrid({ cols = 5 }: { cols?: 4 | 5 }) {
  const gridClass = cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-5';
  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={`skel-${i}`}
          className="animate-pulse border border-border/50 rounded-lg p-6 bg-card h-[140px]"
        >
          <div className="h-3 bg-muted/50 rounded w-1/2 mb-4" />
          <div className="h-10 bg-muted/50 rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted/50 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ── Sub-panels ──

function UsersPanel({ metrics, prev }: { metrics: MarketplaceMetrics; prev?: MarketplaceMetrics }) {
  const approvalRate =
    metrics.newSignups > 0 ? (metrics.usersApproved / metrics.newSignups) * 100 : 0;
  const rejectionRate =
    metrics.newSignups > 0 ? (metrics.usersRejected / metrics.newSignups) * 100 : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SmallStat
          label="New signups"
          value={fmtNum(metrics.newSignups)}
          icon={UserPlus}
          delta={prev ? { current: metrics.newSignups, previous: prev.newSignups } : undefined}
        />
        <SmallStat
          label="Approved"
          value={fmtNum(metrics.usersApproved)}
          icon={CheckCircle2}
          delta={
            prev ? { current: metrics.usersApproved, previous: prev.usersApproved } : undefined
          }
        />
        <SmallStat
          label="Rejected"
          value={fmtNum(metrics.usersRejected)}
          icon={XCircle}
          delta={
            prev ? { current: metrics.usersRejected, previous: prev.usersRejected } : undefined
          }
        />
        <SmallStat label="Pending" value={fmtNum(metrics.usersPending)} icon={Clock} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SmallStat
          label="Approval rate"
          value={`${approvalRate.toFixed(1)}%`}
          icon={CheckCircle2}
        />
        <SmallStat label="Rejection rate" value={`${rejectionRate.toFixed(1)}%`} icon={XCircle} />
      </div>
      {metrics.monthlyTrend.length > 1 && (
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <TrendChart
            data={metrics.monthlyTrend.map((t) => ({ month: t.month, value: t.signups }))}
            label="Signups over time"
          />
        </div>
      )}
    </div>
  );
}

function DealsPanel({ metrics, prev }: { metrics: MarketplaceMetrics; prev?: MarketplaceMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStat
          label="Deals added"
          value={fmtNum(metrics.dealsAdded)}
          icon={Store}
          delta={prev ? { current: metrics.dealsAdded, previous: prev.dealsAdded } : undefined}
        />
        <SmallStat
          label="EBITDA added"
          value={fmtCurrency(metrics.ebitdaAdded)}
          icon={DollarSign}
          delta={prev ? { current: metrics.ebitdaAdded, previous: prev.ebitdaAdded } : undefined}
        />
        <SmallStat
          label="Revenue added"
          value={fmtCurrency(metrics.revenueAdded)}
          icon={LineChart}
          delta={prev ? { current: metrics.revenueAdded, previous: prev.revenueAdded } : undefined}
        />
      </div>
      {metrics.monthlyTrend.length > 1 && (
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <TrendChart
            data={metrics.monthlyTrend.map((t) => ({ month: t.month, value: t.deals }))}
            label="Deals added over time"
          />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <h4 className="text-sm font-semibold mb-4">Deals by status</h4>
          <BreakdownList
            rows={metrics.dealsByStatus.map((d) => ({ label: d.status, count: d.count }))}
            emptyLabel="No deals in this period"
          />
        </div>
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <h4 className="text-sm font-semibold mb-4">Top industries</h4>
          <BreakdownList
            rows={metrics.dealsByIndustry.map((d) => ({ label: d.industry, count: d.count }))}
            emptyLabel="No deals in this period"
          />
        </div>
      </div>
      {metrics.zeroRequestDeals.length > 0 && (
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold">
              Zero-request deals ({metrics.zeroRequestDeals.length})
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Deals added in this period that have never received a connection request.
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {metrics.zeroRequestDeals.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0"
              >
                <div className="min-w-0">
                  <span className="font-medium truncate block">{d.name}</span>
                  {d.industry && (
                    <span className="text-xs text-muted-foreground">{d.industry}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {d.created_at.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionsPanel({
  metrics,
  prev,
}: {
  metrics: MarketplaceMetrics;
  prev?: MarketplaceMetrics;
}) {
  const approvalRate =
    metrics.connectionRequestsCreated > 0
      ? (metrics.connectionRequestsApproved / metrics.connectionRequestsCreated) * 100
      : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SmallStat
          label="Requests created"
          value={fmtNum(metrics.connectionRequestsCreated)}
          icon={MessageSquare}
          delta={
            prev
              ? {
                  current: metrics.connectionRequestsCreated,
                  previous: prev.connectionRequestsCreated,
                }
              : undefined
          }
        />
        <SmallStat
          label="Approved"
          value={fmtNum(metrics.connectionRequestsApproved)}
          icon={CheckCircle2}
          delta={
            prev
              ? {
                  current: metrics.connectionRequestsApproved,
                  previous: prev.connectionRequestsApproved,
                }
              : undefined
          }
        />
        <SmallStat
          label="Rejected"
          value={fmtNum(metrics.connectionRequestsRejected)}
          icon={XCircle}
          delta={
            prev
              ? {
                  current: metrics.connectionRequestsRejected,
                  previous: prev.connectionRequestsRejected,
                }
              : undefined
          }
        />
        <SmallStat
          label="Pending (live)"
          value={fmtNum(metrics.connectionRequestsPending)}
          icon={Clock}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SmallStat
          label="Approval rate"
          value={`${approvalRate.toFixed(1)}%`}
          icon={CheckCircle2}
        />
        <SmallStat
          label="Requests per deal"
          value={metrics.connectionRequestsPerDeal.toFixed(2)}
          icon={Briefcase}
          delta={
            prev
              ? {
                  current: metrics.connectionRequestsPerDeal,
                  previous: prev.connectionRequestsPerDeal,
                }
              : undefined
          }
        />
      </div>
      {metrics.monthlyTrend.length > 1 && (
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <TrendChart
            data={metrics.monthlyTrend.map((t) => ({ month: t.month, value: t.connections }))}
            label="Connection requests over time"
          />
        </div>
      )}
    </div>
  );
}

function MeetingsPanel({
  metrics,
  prev,
}: {
  metrics: MarketplaceMetrics;
  prev?: MarketplaceMetrics;
}) {
  const avgMinutes = metrics.meetingsHeld > 0 ? metrics.meetingMinutes / metrics.meetingsHeld : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStat
          label="Meetings held"
          value={fmtNum(metrics.meetingsHeld)}
          icon={Video}
          delta={prev ? { current: metrics.meetingsHeld, previous: prev.meetingsHeld } : undefined}
        />
        <SmallStat
          label="Total minutes"
          value={fmtNum(metrics.meetingMinutes)}
          icon={Clock}
          delta={
            prev ? { current: metrics.meetingMinutes, previous: prev.meetingMinutes } : undefined
          }
        />
        <SmallStat label="Avg length" value={`${avgMinutes.toFixed(0)} min`} icon={LineChart} />
      </div>
      {metrics.monthlyTrend.length > 1 && (
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <TrendChart
            data={metrics.monthlyTrend.map((t) => ({ month: t.month, value: t.meetings }))}
            label="Meetings over time"
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export function MarketplaceMetricsTab() {
  const [preset, setPreset] = useState<TimelinePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const { current, previous } = useMarketplaceMetricsWithComparison(range);

  const metrics = current.data;
  const prev = previous.data;
  const isLoading = current.isLoading;
  // Previously `isLoading || !metrics` gated every section. When the query
  // errored, isLoading flipped to false but metrics stayed undefined, so the
  // tab was stuck on a skeleton forever with no signal of what broke.
  const queryError = (current.error || previous.error) as Error | null | undefined;

  const rangeLabel = useMemo(() => {
    return `${format(new Date(range.from), 'MMM d, yyyy')} – ${format(new Date(range.to), 'MMM d, yyyy')}`;
  }, [range]);

  const handleExport = useCallback(() => {
    if (metrics) exportMetricsCSV(metrics, rangeLabel);
  }, [metrics, rangeLabel]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Marketplace metrics</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as TimelinePreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {customFrom && customTo ? `${customFrom} – ${customTo}` : 'Set dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">From</label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">To</label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {metrics && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {queryError && (
        <DashboardErrorBanner
          title="Couldn't load marketplace metrics"
          error={queryError}
          onRetry={() => {
            current.refetch();
            previous.refetch();
          }}
        />
      )}

      {/* Hero KPIs */}
      {queryError ? null : isLoading || !metrics ? (
        <LoadingGrid cols={5} />
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          <KpiCard
            label="New signups"
            value={fmtNum(metrics.newSignups)}
            sublabel={`${fmtNum(metrics.usersApproved)} approved`}
            icon={UserPlus}
            delta={prev ? { current: metrics.newSignups, previous: prev.newSignups } : undefined}
          />
          <KpiCard
            label="Deals added"
            value={fmtNum(metrics.dealsAdded)}
            sublabel={`${fmtCurrency(metrics.ebitdaAdded)} EBITDA`}
            icon={Store}
            delta={prev ? { current: metrics.dealsAdded, previous: prev.dealsAdded } : undefined}
          />
          <KpiCard
            label="Connection requests"
            value={fmtNum(metrics.connectionRequestsCreated)}
            sublabel={`${fmtNum(metrics.connectionRequestsApproved)} approved · ${fmtNum(metrics.connectionRequestsRejected)} rejected`}
            icon={MessageSquare}
            delta={
              prev
                ? {
                    current: metrics.connectionRequestsCreated,
                    previous: prev.connectionRequestsCreated,
                  }
                : undefined
            }
          />
          <KpiCard
            label="Requests / deal"
            value={metrics.connectionRequestsPerDeal.toFixed(2)}
            sublabel="Across all listings"
            icon={Briefcase}
            delta={
              prev
                ? {
                    current: metrics.connectionRequestsPerDeal,
                    previous: prev.connectionRequestsPerDeal,
                  }
                : undefined
            }
          />
          <KpiCard
            label="Meetings held"
            value={fmtNum(metrics.meetingsHeld)}
            sublabel={`${fmtNum(metrics.meetingMinutes)} total minutes`}
            icon={Video}
            delta={
              prev ? { current: metrics.meetingsHeld, previous: prev.meetingsHeld } : undefined
            }
          />
        </div>
      )}

      {/* Sub-tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="inline-flex h-9 items-center justify-start rounded-md bg-muted/30 p-1 gap-1">
          <TabsTrigger
            value="users"
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-3 w-3 mr-1.5 inline" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="deals"
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Store className="h-3 w-3 mr-1.5 inline" />
            Deals
          </TabsTrigger>
          <TabsTrigger
            value="connections"
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-3 w-3 mr-1.5 inline" />
            Connections
          </TabsTrigger>
          <TabsTrigger
            value="meetings"
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Video className="h-3 w-3 mr-1.5 inline" />
            Meetings
          </TabsTrigger>
        </TabsList>

        {queryError ? null : isLoading || !metrics ? (
          <div className="mt-6">
            <LoadingGrid cols={4} />
          </div>
        ) : (
          <>
            <TabsContent value="users" className="mt-6">
              <UsersPanel metrics={metrics} prev={prev} />
            </TabsContent>
            <TabsContent value="deals" className="mt-6">
              <DealsPanel metrics={metrics} prev={prev} />
            </TabsContent>
            <TabsContent value="connections" className="mt-6">
              <ConnectionsPanel metrics={metrics} prev={prev} />
            </TabsContent>
            <TabsContent value="meetings" className="mt-6">
              <MeetingsPanel metrics={metrics} prev={prev} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
