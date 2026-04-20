/**
 * PipelineTab.tsx
 *
 * Phase 3 — Pipeline & Velocity tab. Answers "where is the pipeline, where is
 * the value, and where is it stuck?".
 */
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Trophy, FileSignature, Clock } from 'lucide-react';
import { usePipelineMetrics } from './usePipelineMetrics';
import { DashboardErrorBanner } from './DashboardErrorBanner';
import { formatCurrency, type Timeframe } from '../useDashboardData';

interface PipelineTabProps {
  timeframe: Timeframe;
}

function formatInt(n: number): string {
  return n.toLocaleString();
}

export function PipelineTab({ timeframe }: PipelineTabProps) {
  const { loading, error, retry, kpis, stageRows, atRisk, closedWonLog, ndaFeeCounts } =
    usePipelineMetrics(timeframe);

  // Biggest stage (for funnel width normalization)
  const maxStageCount = Math.max(...stageRows.map((s) => s.dealCount), 1);

  return (
    <div className="space-y-5">
      {error && (
        <DashboardErrorBanner title="Couldn't load Pipeline data" error={error} onRetry={retry} />
      )}
      {/* In-period KPIs (respect timeframe filter) */}
      {loading && !error ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">In period</p>
          <div className="grid gap-3 md:grid-cols-4">
            <KPICard
              label="Deals Created"
              value={`+${formatInt(kpis.newInPeriod)}`}
              subtitle="added to platform"
            />
            <KPICard
              label="Closed Won"
              value={formatInt(kpis.closedWonInPeriod)}
              subtitle="in period"
            />
            <KPICard
              label="NDAs Signed"
              value={formatInt(ndaFeeCounts.ndaSignedInPeriod)}
              subtitle="in period"
            />
            <KPICard
              label="Fee Agreements"
              value={formatInt(ndaFeeCounts.feeSignedInPeriod)}
              subtitle="signed in period"
            />
          </div>
        </div>
      )}

      {/* Current-snapshot KPIs (not affected by timeframe) */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Current snapshot
          </p>
          <div className="grid gap-3 md:grid-cols-5">
            <KPICard
              label="Pipeline EBITDA"
              value={formatCurrency(kpis.totalPipelineEbitda)}
              subtitle={`${kpis.totalPipelineDeals} deals`}
            />
            <KPICard
              label="Deals in Pipeline"
              value={formatInt(kpis.totalPipelineDeals)}
              subtitle="active stages"
            />
            <KPICard
              label="Avg Days to Close"
              value={
                kpis.avgDaysToClose != null && kpis.avgDaysToClose > 0
                  ? `${kpis.avgDaysToClose}d`
                  : '—'
              }
              subtitle={kpis.avgDaysToClose == null ? 'no closed deals yet' : 'historical average'}
            />
            <KPICard
              label="NDA → Fee"
              value={`${kpis.ndaToFeeRate.toFixed(1)}%`}
              subtitle="signed-to-signed"
            />
            <KPICard
              label="Stalled"
              value={formatInt(kpis.stalledCount)}
              subtitle=">30 days no move"
              highlight={kpis.stalledCount > 0}
            />
          </div>
        </div>
      )}

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Pipeline Funnel
          </h3>
          <span className="text-xs text-gray-400">
            {formatCurrency(stageRows.reduce((s, r) => s + r.totalEbitda, 0))} total
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-60 w-full" />
        ) : stageRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No pipeline data</p>
        ) : (
          <div className="space-y-2">
            {stageRows.map((stage) => {
              const widthPct = (stage.dealCount / maxStageCount) * 100;
              return (
                <div key={stage.stageId} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs text-gray-700 font-medium">
                    {stage.stageName}
                  </div>
                  <div className="flex-1 relative h-8 bg-gray-50 rounded-md overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-md transition-all flex items-center px-3"
                      style={{
                        width: `${Math.max(widthPct, 4)}%`,
                        backgroundColor: stage.color,
                        opacity: 0.85,
                      }}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {stage.dealCount}
                      </span>
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-xs text-right text-gray-700 font-medium">
                    {formatCurrency(stage.totalEbitda)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NDA/Fee tracker */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            NDA &amp; Fee Agreement Tracker
          </h3>
          <FileSignature className="h-3.5 w-3.5 text-gray-400" />
        </div>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <TrackerBox label="NDAs Sent" value={ndaFeeCounts.ndaSent} color="text-blue-600" />
            <TrackerBox
              label="NDAs Signed"
              value={ndaFeeCounts.ndaSigned}
              color="text-emerald-600"
            />
            <TrackerBox
              label="Fee Agreements Sent"
              value={ndaFeeCounts.feeSent}
              color="text-purple-600"
            />
            <TrackerBox
              label="Fee Agreements Signed"
              value={ndaFeeCounts.feeSigned}
              color="text-green-600"
            />
          </div>
        )}
      </div>

      {/* At-Risk Deals + Closed Won Log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              At-Risk Deals
            </h3>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : atRisk.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nothing stalled &gt;30d</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {atRisk.map((d) => (
                <Link
                  key={d.id}
                  to={`/admin/pipeline/${d.id}`}
                  className="block p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50/50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate flex-1">
                      {d.companyName}
                    </p>
                    <span className="text-sm font-semibold text-gray-700 ml-2">
                      {formatCurrency(d.ebitda)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${d.stageColor}20`,
                        color: d.stageColor,
                      }}
                    >
                      {d.stageName}
                    </span>
                    <span className="text-[11px] text-amber-600 font-medium">
                      {d.daysInStage}d stalled
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Closed Won Log
            </h3>
            <Trophy className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : closedWonLog.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No closed deals in period</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {closedWonLog.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate flex-1">
                      {d.companyName}
                    </p>
                    <span className="text-sm font-semibold text-emerald-700 ml-2">
                      {formatCurrency(d.ebitda)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-gray-500">{d.source || 'unknown'}</span>
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {d.daysToClose}d ·{' '}
                      {formatDistanceToNow(new Date(d.closedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        highlight ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function TrackerBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">{label}</p>
    </div>
  );
}
