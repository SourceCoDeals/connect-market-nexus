import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import {
  useMarketplaceMetrics,
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

type TimelinePreset = 'today' | '7d' | '30d' | 'mtd' | 'qtd' | 'ytd' | '12mo';

interface PresetOption {
  value: TimelinePreset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12mo', label: 'Last 12 months' },
];

function rangeForPreset(preset: TimelinePreset): MarketplaceMetricsRange {
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
  }
}

function formatCurrencyCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'default' | 'success' | 'danger' | 'warning';
}

function KpiCard({ label, value, sublabel, icon: Icon, accent = 'default' }: KpiCardProps) {
  const accentClass = {
    default: 'text-muted-foreground/40',
    success: 'text-emerald-500/60',
    danger: 'text-red-500/60',
    warning: 'text-amber-500/60',
  }[accent];

  return (
    <div className="border border-border/50 rounded-lg p-6 bg-card hover:border-border transition-all">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accentClass}`} />
      </div>
      <div className="text-4xl font-semibold tracking-tight mb-2">{value}</div>
      {sublabel && <p className="text-xs text-muted-foreground/70">{sublabel}</p>}
    </div>
  );
}

function SmallStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 border border-border/50 rounded-lg p-4 bg-card">
      <Icon className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground/70 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-semibold tracking-tight mt-1">{value}</div>
      </div>
    </div>
  );
}

function BreakdownList({
  rows,
  emptyLabel,
}: {
  rows: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground/70 py-4">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = max > 0 ? (row.count / max) * 100 : 0;
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground truncate pr-2">{row.label}</span>
              <span className="text-muted-foreground tabular-nums flex-shrink-0">
                {formatNumber(row.count)}
              </span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/70 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingGrid({ cols = 5 }: { cols?: 4 | 5 }) {
  // Tailwind classes must be statically known, so we switch on known values.
  const gridClass = cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-5';
  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
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

interface MetricsContext {
  metrics: MarketplaceMetrics;
}

function UsersPanel({ metrics }: MetricsContext) {
  const approvalRate =
    metrics.newSignups > 0 ? (metrics.usersApproved / metrics.newSignups) * 100 : 0;
  const rejectionRate =
    metrics.newSignups > 0 ? (metrics.usersRejected / metrics.newSignups) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SmallStat label="New signups" value={formatNumber(metrics.newSignups)} icon={UserPlus} />
        <SmallStat
          label="Approved"
          value={formatNumber(metrics.usersApproved)}
          icon={CheckCircle2}
        />
        <SmallStat label="Rejected" value={formatNumber(metrics.usersRejected)} icon={XCircle} />
        <SmallStat label="Pending" value={formatNumber(metrics.usersPending)} icon={Clock} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SmallStat
          label="Approval rate"
          value={`${approvalRate.toFixed(1)}%`}
          icon={CheckCircle2}
        />
        <SmallStat label="Rejection rate" value={`${rejectionRate.toFixed(1)}%`} icon={XCircle} />
      </div>
      <p className="text-xs text-muted-foreground/60">
        Users are bucketed by signup date. &quot;Approved&quot; / &quot;Rejected&quot; counts the
        users who signed up in this period and currently hold that status.
      </p>
    </div>
  );
}

function DealsPanel({ metrics }: MetricsContext) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStat label="Deals added" value={formatNumber(metrics.dealsAdded)} icon={Store} />
        <SmallStat
          label="EBITDA added"
          value={formatCurrencyCompact(metrics.ebitdaAdded)}
          icon={DollarSign}
        />
        <SmallStat
          label="Revenue added"
          value={formatCurrencyCompact(metrics.revenueAdded)}
          icon={LineChart}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <h4 className="text-sm font-semibold mb-4">Deals by status</h4>
          <BreakdownList
            rows={metrics.dealsByStatus.map((d) => ({ label: d.status, count: d.count }))}
            emptyLabel="No deals added in this period"
          />
        </div>
        <div className="border border-border/50 rounded-lg p-6 bg-card">
          <h4 className="text-sm font-semibold mb-4">Top industries</h4>
          <BreakdownList
            rows={metrics.dealsByIndustry.map((d) => ({ label: d.industry, count: d.count }))}
            emptyLabel="No deals added in this period"
          />
        </div>
      </div>
    </div>
  );
}

function ConnectionsPanel({ metrics }: MetricsContext) {
  const approvalRate =
    metrics.connectionRequestsCreated > 0
      ? (metrics.connectionRequestsApproved / metrics.connectionRequestsCreated) * 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SmallStat
          label="Requests created"
          value={formatNumber(metrics.connectionRequestsCreated)}
          icon={MessageSquare}
        />
        <SmallStat
          label="Approved"
          value={formatNumber(metrics.connectionRequestsApproved)}
          icon={CheckCircle2}
        />
        <SmallStat
          label="Rejected"
          value={formatNumber(metrics.connectionRequestsRejected)}
          icon={XCircle}
        />
        <SmallStat
          label="Pending (live)"
          value={formatNumber(metrics.connectionRequestsPending)}
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
        />
      </div>
      <p className="text-xs text-muted-foreground/60">
        Approved and rejected counts are bucketed by their decision timestamp. Pending is a live
        snapshot across the whole marketplace (not date-filtered). Requests-per-deal uses all
        listings as the denominator so it reflects marketplace-wide demand.
      </p>
    </div>
  );
}

function MeetingsPanel({ metrics }: MetricsContext) {
  const avgMinutes =
    metrics.meetingsHeld > 0 ? metrics.meetingMinutes / metrics.meetingsHeld : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStat label="Meetings held" value={formatNumber(metrics.meetingsHeld)} icon={Video} />
        <SmallStat
          label="Total minutes"
          value={formatNumber(metrics.meetingMinutes)}
          icon={Clock}
        />
        <SmallStat
          label="Avg length"
          value={`${avgMinutes.toFixed(0)} min`}
          icon={LineChart}
        />
      </div>
      <p className="text-xs text-muted-foreground/60">
        Meetings are sourced from the Fireflies standup transcript pipeline and are not yet linked
        to a specific listing or connection request.
      </p>
    </div>
  );
}

export function MarketplaceMetricsTab() {
  const [preset, setPreset] = useState<TimelinePreset>('30d');
  const range = useMemo(() => rangeForPreset(preset), [preset]);
  const { data: metrics, isLoading } = useMarketplaceMetrics(range);

  const rangeLabel = useMemo(() => {
    return `${format(new Date(range.from), 'MMM d, yyyy')} – ${format(
      new Date(range.to),
      'MMM d, yyyy',
    )}`;
  }, [range]);

  return (
    <div className="space-y-8">
      {/* Header with timeline filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Marketplace metrics</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{rangeLabel}</p>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as TimelinePreset)}>
          <SelectTrigger className="w-[200px]">
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
      </div>

      {/* Hero KPI strip — the 5 numbers an exec glances at first */}
      {isLoading || !metrics ? (
        <LoadingGrid cols={5} />
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          <KpiCard
            label="New signups"
            value={formatNumber(metrics.newSignups)}
            sublabel={`${formatNumber(metrics.usersApproved)} approved`}
            icon={UserPlus}
          />
          <KpiCard
            label="Deals added"
            value={formatNumber(metrics.dealsAdded)}
            sublabel={`${formatCurrencyCompact(metrics.ebitdaAdded)} EBITDA`}
            icon={Store}
          />
          <KpiCard
            label="Connection requests"
            value={formatNumber(metrics.connectionRequestsCreated)}
            sublabel={`${formatNumber(metrics.connectionRequestsApproved)} approved · ${formatNumber(metrics.connectionRequestsRejected)} rejected`}
            icon={MessageSquare}
          />
          <KpiCard
            label="Requests / deal"
            value={metrics.connectionRequestsPerDeal.toFixed(2)}
            sublabel="Across all listings"
            icon={Briefcase}
          />
          <KpiCard
            label="Meetings held"
            value={formatNumber(metrics.meetingsHeld)}
            sublabel={`${formatNumber(metrics.meetingMinutes)} total minutes`}
            icon={Video}
          />
        </div>
      )}

      {/* Category sub-tabs */}
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

        {isLoading || !metrics ? (
          <div className="mt-6">
            <LoadingGrid cols={4} />
          </div>
        ) : (
          <>
            <TabsContent value="users" className="mt-6">
              <UsersPanel metrics={metrics} />
            </TabsContent>
            <TabsContent value="deals" className="mt-6">
              <DealsPanel metrics={metrics} />
            </TabsContent>
            <TabsContent value="connections" className="mt-6">
              <ConnectionsPanel metrics={metrics} />
            </TabsContent>
            <TabsContent value="meetings" className="mt-6">
              <MeetingsPanel metrics={metrics} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
