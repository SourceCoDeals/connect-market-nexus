/**
 * DealSupplyTab.tsx
 *
 * Phase 1 content for the Remarketing Dashboard — answers "are we getting enough
 * quality deal flow?".
 *
 * Reuses useDashboardData (same hook the hero strip uses) so the TanStack Query
 * cache deduplicates the RPC call between parent and child.
 */
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { DealSourceBadge } from '@/components/remarketing/DealSourceBadge';
import { formatDistanceToNow } from 'date-fns';
import { BarChart3, ArrowUpRight, Zap, Clock, Phone, CheckCircle2 } from 'lucide-react';

import { WeeklyChart } from '../DashboardCharts';
import {
  useDashboardData,
  formatCurrency,
  scorePillClass,
  SOURCE_COLORS,
  SOURCE_LABELS,
  type Timeframe,
} from '../useDashboardData';

interface DealSupplyTabProps {
  timeframe: Timeframe;
}

export function DealSupplyTab({ timeframe }: DealSupplyTabProps) {
  const {
    loading,
    universesLoading,
    cards,
    newBySource,
    allBySource,
    ebitdaBySource,
    industryBreakdown,
    topDeals,
    weeklyData,
    recentActivity,
    scoreBuckets,
    universeMetrics,
    callActivity,
    callActivityLoading,
  } = useDashboardData(timeframe);

  const formatTalkTime = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-5">
      {/* KPI Row — 4 cards */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        cards && (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Total Active</p>
              <p className="text-2xl font-bold mt-1">{cards.all_visible}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">New in Period</p>
              <p className="text-2xl font-bold mt-1">+{cards.all_new_in_period}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Total Scored</p>
              <p className="text-2xl font-bold mt-1">{cards.total_scored}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Enrichment Rate</p>
              <p className="text-2xl font-bold mt-1">
                {cards.all_visible > 0
                  ? `${Math.round((cards.enriched / cards.all_visible) * 100)}%`
                  : '—'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {cards.enriched}/{cards.all_visible}
              </p>
            </div>
          </div>
        )
      )}

      {/* Call Activity row */}
      {callActivityLoading ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        callActivity && (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Calls Made</p>
                <p className="text-xl font-bold">{callActivity.totalCalls}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Connected</p>
                <p className="text-xl font-bold">
                  {callActivity.connects}
                  <span className="text-xs text-gray-500 font-normal ml-1.5">
                    ({callActivity.connectRate}%)
                  </span>
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Talk Time</p>
                <p className="text-xl font-bold">{formatTalkTime(callActivity.totalTalkSeconds)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Voicemails</p>
                <p className="text-xl font-bold">{callActivity.voicemails}</p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Weekly trend + source panels */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <WeeklyChart weeklyData={weeklyData as Record<string, number>} />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">
            CapTarget
          </h3>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            cards && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{cards.ct_new}</p>
                    <p className="text-[10px] text-gray-500 uppercase">New</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {cards.ct_approved_in_period}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Approved</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{cards.ct_avg}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Avg</p>
                  </div>
                </div>
                <div className="border-t mt-4 pt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{cards.ct_total} total</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${scorePillClass(cards.ct_avg)}`}
                  >
                    {cards.ct_avg}
                  </span>
                </div>
              </>
            )
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">
            GP Partners
          </h3>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            cards && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{cards.gp_new}</p>
                    <p className="text-[10px] text-gray-500 uppercase">New</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {cards.gp_approved_in_period}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Approved</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{cards.gp_avg}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Avg</p>
                  </div>
                </div>
                <div className="border-t mt-4 pt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{cards.gp_total} total</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${scorePillClass(cards.gp_avg)}`}
                  >
                    {cards.gp_avg}
                  </span>
                </div>
              </>
            )
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">
            SourceCo
          </h3>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            cards && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold text-cyan-600">{cards.sc_new}</p>
                    <p className="text-[10px] text-gray-500 uppercase">New</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {cards.sc_approved_in_period}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Approved</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{cards.sc_avg}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Avg</p>
                  </div>
                </div>
                <div className="border-t mt-4 pt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{cards.sc_total} total</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${scorePillClass(cards.sc_avg)}`}
                  >
                    {cards.sc_avg}
                  </span>
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* EBITDA by Source + Top Industries */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              EBITDA by Source
            </h3>
            <span className="text-xs text-gray-400">
              {formatCurrency(cards?.total_pipeline_ebitda ?? 0)} total
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            (() => {
              const entries = Object.entries(ebitdaBySource as Record<string, number>)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a);
              if (entries.length === 0) {
                return <p className="text-sm text-gray-400 text-center py-6">No EBITDA data</p>;
              }
              const maxVal = Math.max(...entries.map(([, v]) => v), 1);
              return (
                <div className="space-y-3">
                  {entries.map(([src, val]) => (
                    <div key={src}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: SOURCE_COLORS[src] || '#94a3b8' }}
                          />
                          <span className="text-gray-700">{SOURCE_LABELS[src] || src}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(val)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(val / maxVal) * 100}%`,
                            backgroundColor: SOURCE_COLORS[src] || '#94a3b8',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Top Industries
            </h3>
            <span className="text-xs text-gray-400">{industryBreakdown.length} of top 10</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : industryBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No industry data</p>
          ) : (
            (() => {
              const maxCnt = Math.max(...industryBreakdown.map((i) => i.cnt), 1);
              return (
                <div className="space-y-2.5">
                  {industryBreakdown.map((row) => (
                    <div key={row.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 truncate pr-2">{row.category}</span>
                        <span className="font-medium text-gray-800">{row.cnt}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(row.cnt / maxCnt) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Source breakdown + Score distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              New Opportunities by Source
            </h3>
            <span className="text-xs text-gray-400">
              {loading
                ? '...'
                : Object.values(newBySource as Record<string, number>).reduce(
                    (a: number, b: number) => a + b,
                    0,
                  )}{' '}
              added
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            (() => {
              const entries = Object.entries(newBySource as Record<string, number>).sort(
                ([, a], [, b]) => b - a,
              );
              const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
              return (
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-4">
                    {entries.map(([src, count]) => (
                      <div
                        key={src}
                        style={{
                          width: `${(count / total) * 100}%`,
                          backgroundColor: SOURCE_COLORS[src] || '#94a3b8',
                        }}
                      />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {entries.map(([src, count]) => (
                      <div key={src} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: SOURCE_COLORS[src] || '#94a3b8' }}
                          />
                          <span className="text-gray-700">{SOURCE_LABELS[src] || src}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">
                            {Math.round((count / total) * 100)}%
                          </span>
                          <span className="font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Deals by Score
            </h3>
            <span className="text-xs text-gray-400">{cards?.total_scored || 0} scored</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-3">
              {scoreBuckets.map((b) => {
                const maxCount = Math.max(...scoreBuckets.map((x) => x.count), 1);
                return (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="text-gray-600">{b.label}</span>
                        <span className="text-gray-400">{b.tag}</span>
                      </div>
                      <span className="font-medium text-gray-800">{b.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(b.count / maxCount) * 100}%`,
                          backgroundColor: b.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 10 opportunities table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Top Opportunities Added
          </h3>
          <span className="text-xs text-gray-400">Highest scored in period</span>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : topDeals.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No scored deals in this period</p>
          </div>
        ) : (
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
                {topDeals.map((deal: Record<string, unknown>, i: number) => (
                  <tr key={String(deal.id)} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <Link
                        to={`/admin/deals/${deal.id}`}
                        state={{ from: '/admin' }}
                        className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {String(deal.internal_company_name || deal.title || '—')}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <DealSourceBadge source={deal.deal_source as string | undefined} />
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600 truncate max-w-[120px]">
                      {String(deal.category || '—')}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-gray-700">
                      {formatCurrency(deal.revenue as number | null | undefined)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-gray-700">
                      {formatCurrency(deal.ebitda as number | null | undefined)}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${scorePillClass(deal.deal_total_score as number | null)}`}
                      >
                        {String(deal.deal_total_score ?? '')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600">
                      {String(deal.address_state || '—')}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 text-xs">
                      {formatDistanceToNow(new Date(deal.created_at as string), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active by Source + Universes + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Active by Source
            </h3>
            <span className="text-xs text-gray-400">{cards?.all_visible || 0} total</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            (() => {
              const entries = Object.entries(allBySource as Record<string, number>).sort(
                ([, a], [, b]) => b - a,
              );
              const maxCount = Math.max(...entries.map(([, v]) => v), 1);
              return (
                <div>
                  <div className="space-y-2.5">
                    {entries.map(([src, count]) => (
                      <div key={src}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: SOURCE_COLORS[src] || '#94a3b8' }}
                            />
                            <span className="text-gray-700">{SOURCE_LABELS[src] || src}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(count / maxCount) * 100}%`,
                              backgroundColor: SOURCE_COLORS[src] || '#94a3b8',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-4 pt-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                      Enrichment
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200"
                      >
                        {cards?.enriched || 0} Enriched
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"
                      >
                        {cards?.pending_enrichment || 0} Pending
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200"
                      >
                        {cards?.failed_enrichment || 0} Failed
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Buyer Universes
            </h3>
            <span className="text-xs text-gray-400">{universeMetrics?.length || 0} active</span>
          </div>
          {universesLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : universeMetrics && universeMetrics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active universes</p>
          ) : (
            universeMetrics && (
              <div className="space-y-3 max-h-52 overflow-y-auto">
                {universeMetrics.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/admin/buyers/universes/${u.id}`}
                        className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate"
                      >
                        {u.name}
                      </Link>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">{u.buyers} buyers</span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {u.totalScored} scored
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200"
                      >
                        {u.approved} approved
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Recent Activity
            </h3>
            <Clock className="h-3.5 w-3.5 text-gray-400" />
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((ev) => {
                const iconColor =
                  ev.type === 'pushed'
                    ? 'bg-green-100 text-green-600'
                    : ev.source === 'captarget'
                      ? 'bg-blue-100 text-blue-600'
                      : ev.source === 'gp_partners'
                        ? 'bg-orange-100 text-orange-600'
                        : ev.source === 'referral'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-gray-100 text-gray-600';
                return (
                  <div key={`${ev.name}-${ev.date}`} className="flex items-start gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                    >
                      {ev.type === 'pushed' ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate">
                        {ev.type === 'pushed' ? 'Pushed to Active Deals' : 'Deal created'}:{' '}
                        <span className="font-medium">{String(ev.name)}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <DealSourceBadge source={String(ev.source)} />
                        <span className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(String(ev.date)), { addSuffix: true })}
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
}
