/**
 * IntrosTab.tsx
 *
 * Phase 5 — Introductions & Meetings. Answers "are we connecting buyers to
 * deals and are those intros progressing?".
 */
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Calendar, Clock, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useIntrosMetrics } from './useIntrosMetrics';
import type { Timeframe } from '../useDashboardData';

interface IntrosTabProps {
  timeframe: Timeframe;
}

// Production status colors. "Deeper" in the funnel = warmer color.
const STATUS_COLORS: Record<string, string> = {
  need_to_show_deal: '#94a3b8',
  outreach_initiated: '#f59e0b',
  fit_and_interested: '#2563eb',
  meeting_scheduled: '#16a34a',
  not_a_fit: '#dc2626',
  // Legacy
  not_introduced: '#94a3b8',
  introduction_scheduled: '#f59e0b',
  introduced: '#16a34a',
  passed: '#dc2626',
  rejected: '#7c2d12',
};

function formatInt(n: number): string {
  return n.toLocaleString();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function IntrosTab({ timeframe }: IntrosTabProps) {
  const { loading, kpis, statusBreakdown, weeklyTrend, recentMeetings } =
    useIntrosMetrics(timeframe);

  const totalStatuses = statusBreakdown.reduce((s, v) => s + v.count, 0) || 1;
  const maxWeek = Math.max(...weeklyTrend.map((p) => Math.max(p.intros, p.meetings)), 1);

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <KPICard
            label="Introductions"
            value={formatInt(kpis.introductionsInPeriod)}
            subtitle="in period"
            icon={<UserPlus className="h-4 w-4" />}
          />
          <KPICard
            label="Intro → Meeting"
            value={`${kpis.introToMeetingRate.toFixed(1)}%`}
            subtitle="conversion"
            icon={<Target className="h-4 w-4" />}
          />
          <KPICard
            label="Meetings Held"
            value={formatInt(kpis.meetingsHeld)}
            subtitle="in period"
            icon={<Calendar className="h-4 w-4" />}
          />
          <KPICard
            label="Meeting Minutes"
            value={formatDuration(kpis.totalMeetingMinutes)}
            subtitle="total talk time"
            icon={<Clock className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Status Breakdown + Weekly Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Introduction Status
            </h3>
            <span className="text-xs text-gray-400">{kpis.totalIntros} total</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : statusBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No introductions yet</p>
          ) : (
            <div className="space-y-3">
              {statusBreakdown.map((s) => {
                const pct = Math.round((s.count / totalStatuses) * 100);
                const color = STATUS_COLORS[s.status] || '#94a3b8';
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-700">{s.label}</span>
                      </div>
                      <span className="font-medium">
                        {s.count} <span className="text-gray-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Weekly Volume
            </h3>
            <span className="text-xs text-gray-400">12 weeks</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : weeklyTrend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No activity in 12 weeks</p>
          ) : (
            <div>
              <div className="flex items-end h-32 gap-1.5">
                {weeklyTrend.map((p) => (
                  <div
                    key={p.week}
                    className="flex-1 flex flex-col items-center justify-end gap-0.5"
                  >
                    <div className="w-full flex flex-col justify-end h-full gap-0.5">
                      <div
                        className="w-full bg-green-500 rounded-t"
                        style={{
                          height: `${(p.meetings / maxWeek) * 100}%`,
                          minHeight: p.meetings > 0 ? '2px' : '0',
                        }}
                        title={`${p.meetings} meetings`}
                      />
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{
                          height: `${(p.intros / maxWeek) * 100}%`,
                          minHeight: p.intros > 0 ? '2px' : '0',
                        }}
                        title={`${p.intros} intros`}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400">
                      {new Date(p.week).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                  <span className="text-gray-600">Introductions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-sm" />
                  <span className="text-gray-600">Meetings</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Recent Meetings
          </h3>
          <span className="text-xs text-gray-400">Last 10</span>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : recentMeetings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No recent meetings</p>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.title || 'Untitled meeting'}
                    </p>
                    {m.key_points && m.key_points.length > 0 && (
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                        {m.key_points[0]}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-gray-700">
                      {m.duration_minutes ? formatDuration(m.duration_minutes) : '—'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {m.call_date
                        ? formatDistanceToNow(new Date(m.call_date), { addSuffix: true })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}
