/**
 * OutreachTab.tsx
 *
 * Phase 2 — Outreach & Campaigns tab. Answers "is our outreach machine working?".
 */
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Phone, Linkedin, TrendingUp } from 'lucide-react';
import { useOutreachMetrics } from './useOutreachMetrics';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import type { Timeframe } from '../useDashboardData';

interface OutreachTabProps {
  timeframe: Timeframe;
}

const REPLY_CATEGORY_COLORS: Record<string, string> = {
  Interested: '#16a34a',
  'Not Interested': '#dc2626',
  'Out of Office': '#f59e0b',
  Question: '#2563eb',
  Referral: '#7c3aed',
  Uncategorized: '#94a3b8',
};

function formatInt(n: number): string {
  return n.toLocaleString();
}

export function OutreachTab({ timeframe }: OutreachTabProps) {
  const {
    loading,
    error,
    retry,
    kpis,
    smartleadCampaigns,
    heyreachCampaigns,
    weeklyTrend,
    replyCategories,
  } = useOutreachMetrics(timeframe);

  const totalReplies = replyCategories.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div className="space-y-5">
      {error && (
        <DashboardErrorBanner title="Couldn't load Outreach data" error={error} onRetry={retry} />
      )}
      {/* KPI Row — 6 */}
      {loading && !error ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KPICard
            label="Emails Sent"
            value={formatInt(kpis.emailsSent)}
            subtitle={`${formatInt(kpis.emailsOpened)} opened`}
            icon={<Mail className="h-4 w-4" />}
          />
          <KPICard
            label="Open Rate"
            value={`${kpis.emailOpenRate.toFixed(1)}%`}
            subtitle="of sent"
          />
          <KPICard
            label="Reply Rate"
            value={`${kpis.emailReplyRate.toFixed(1)}%`}
            subtitle={`${formatInt(kpis.emailsReplied)} replies`}
          />
          <KPICard
            label="Calls Made"
            value={formatInt(kpis.callsMade)}
            subtitle={`${formatInt(kpis.callsConnected)} connected`}
            icon={<Phone className="h-4 w-4" />}
          />
          <KPICard
            label="Connect Rate"
            value={`${kpis.callConnectRate.toFixed(1)}%`}
            subtitle="of calls"
          />
          <KPICard
            label="LinkedIn"
            value={formatInt(kpis.linkedinSent)}
            subtitle={`${formatInt(kpis.linkedinReplied)} replied · ${kpis.linkedinReplyRate.toFixed(1)}%`}
            icon={<Linkedin className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Channel Comparison + Weekly Trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Outreach Volume Trend
            </h3>
            <span className="text-xs text-gray-400">12 weeks</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : weeklyTrend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No outreach in period</p>
          ) : (
            <OutreachTrendChart points={weeklyTrend} />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Channel Performance
            </h3>
            <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <ChannelRow
                label="Email"
                rate={kpis.emailReplyRate}
                color="#2563eb"
                sub={`${formatInt(kpis.emailsReplied)}/${formatInt(kpis.emailsSent)}`}
              />
              <ChannelRow
                label="LinkedIn"
                rate={kpis.linkedinReplyRate}
                color="#0891b2"
                sub={`${formatInt(kpis.linkedinReplied)}/${formatInt(kpis.linkedinSent)}`}
              />
              <ChannelRow
                label="Phone"
                rate={kpis.callConnectRate}
                color="#16a34a"
                sub={`${formatInt(kpis.callsConnected)}/${formatInt(kpis.callsMade)}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* SmartLead Campaigns */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            SmartLead Campaigns
          </h3>
          <span className="text-xs text-gray-400">{smartleadCampaigns.length} active</span>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : smartleadCampaigns.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            <p>No campaigns with synced messages in period</p>
            <p className="text-[11px] mt-1 text-gray-400">
              Campaign rows require at least one smartlead_messages entry. If you have active
              campaigns but zero here, check the SmartLead sync job.
            </p>
          </div>
        ) : (
          <CampaignTable rows={smartleadCampaigns} />
        )}
      </div>

      {/* HeyReach Campaigns + Reply Inbox */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              HeyReach Campaigns
            </h3>
            <span className="text-xs text-gray-400">{heyreachCampaigns.length} active</span>
          </div>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : heyreachCampaigns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No HeyReach activity in period</p>
          ) : (
            <CampaignTable rows={heyreachCampaigns} hideOpened />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Reply Inbox Categories
            </h3>
            <span className="text-xs text-gray-400">
              {formatInt(replyCategories.reduce((s, r) => s + r.count, 0))} replies
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : replyCategories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No AI-categorized replies yet</p>
          ) : (
            <div className="space-y-3">
              {replyCategories.map((cat) => {
                const pct = Math.round((cat.count / totalReplies) * 100);
                const color = REPLY_CATEGORY_COLORS[cat.category] || '#94a3b8';
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-700">{cat.category}</span>
                      </div>
                      <span className="font-medium">
                        {cat.count} <span className="text-gray-400">({pct}%)</span>
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
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
}

function KPICard({ label, value, subtitle, icon }: KPICardProps) {
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

interface ChannelRowProps {
  label: string;
  rate: number;
  color: string;
  sub: string;
}

function ChannelRow({ label, rate, color, sub }: ChannelRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="font-semibold" style={{ color }}>
          {rate.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

interface CampaignTableProps {
  rows: Array<{
    campaignId: number;
    name: string;
    leadCount: number;
    sent: number;
    opened: number;
    replied: number;
    replyRate: number;
  }>;
  hideOpened?: boolean;
}

function CampaignTable({ rows, hideOpened }: CampaignTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b">
            <th className="pb-2 pr-3">Campaign</th>
            <th className="pb-2 pr-3 text-right">Leads</th>
            <th className="pb-2 pr-3 text-right">Sent</th>
            {!hideOpened && <th className="pb-2 pr-3 text-right">Opened</th>}
            <th className="pb-2 pr-3 text-right">Replied</th>
            <th className="pb-2 text-right">Reply Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaignId} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 pr-3 font-medium text-gray-900 truncate max-w-[240px]">
                {r.name}
              </td>
              <td className="py-2.5 pr-3 text-right text-gray-700">{r.leadCount}</td>
              <td className="py-2.5 pr-3 text-right text-gray-700">{r.sent}</td>
              {!hideOpened && <td className="py-2.5 pr-3 text-right text-gray-700">{r.opened}</td>}
              <td className="py-2.5 pr-3 text-right text-gray-700">{r.replied}</td>
              <td className="py-2.5 text-right">
                <span
                  className={`font-semibold ${
                    r.replyRate >= 5
                      ? 'text-emerald-600'
                      : r.replyRate >= 2
                        ? 'text-amber-600'
                        : 'text-gray-500'
                  }`}
                >
                  {r.replyRate.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OutreachTrendChartProps {
  points: Array<{ week: string; emails: number; calls: number; linkedin: number }>;
}

/**
 * Lightweight SVG line chart for the outreach volume trend. Plots emails, calls,
 * and LinkedIn as three separate lines so viewers can compare channels at a glance.
 */
function OutreachTrendChart({ points }: OutreachTrendChartProps) {
  if (points.length === 0) return null;

  const W = 600;
  const H = 180;
  const PL = 35;
  const PR = 10;
  const PT = 15;
  const PB = 30;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const max = Math.max(...points.flatMap((p) => [p.emails, p.calls, p.linkedin]), 1);

  const series = [
    { key: 'emails' as const, label: 'Email', color: '#2563eb' },
    { key: 'linkedin' as const, label: 'LinkedIn', color: '#0891b2' },
    { key: 'calls' as const, label: 'Calls', color: '#16a34a' },
  ];

  const xAt = (i: number) => PL + (i / (points.length - 1 || 1)) * chartW;
  const yAt = (v: number) => PT + chartH - (v / max) * chartH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = PT + chartH - pct * chartH;
          return (
            <g key={y}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PL - 4} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="9">
                {Math.round(pct * max)}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        {series.map((s) => {
          const path = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p[s.key])}`)
            .join(' ');
          return (
            <path
              key={s.key}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* X labels */}
        {points.map((p, i) => (
          <text
            key={p.week}
            x={xAt(i)}
            y={PT + chartH + 14}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize="8"
          >
            {new Date(p.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[11px]">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-600">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
