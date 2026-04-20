/**
 * BuyersTab.tsx
 *
 * Phase 4 — Buyer Intelligence. Answers "is our buyer universe big enough,
 * deep enough, and engaged enough?".
 */
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, FileCheck, AlertCircle } from 'lucide-react';
import { useBuyerMetrics } from './useBuyerMetrics';
import { DashboardErrorBanner } from './DashboardErrorBanner';

const BUYER_TYPE_COLORS: Record<string, string> = {
  private_equity: '#2563eb',
  corporate: '#7c3aed',
  family_office: '#f59e0b',
  independent_sponsor: '#0891b2',
  individual_buyer: '#16a34a',
  search_fund: '#db2777',
  // Legacy values (back-compat)
  pe_firm: '#2563eb',
  platform: '#0891b2',
  strategic: '#7c3aed',
  other: '#94a3b8',
  __unspecified: '#94a3b8',
};

function formatInt(n: number): string {
  return n.toLocaleString();
}

export function BuyersTab() {
  const { loading, error, retry, kpis, contactsHistogram, growthSeries, buyersWithNoContacts } =
    useBuyerMetrics();

  const maxHistCount = Math.max(...contactsHistogram.map((b) => b.count), 1);
  const maxGrowth = Math.max(...growthSeries.map((p) => p.count), 1);

  return (
    <div className="space-y-5">
      {error && (
        <DashboardErrorBanner title="Couldn't load Buyers data" error={error} onRetry={retry} />
      )}
      {/* KPI Row */}
      {loading && !error ? (
        <div className="grid gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          <KPICard
            label="Total Active"
            value={formatInt(kpis.totalActive)}
            subtitle="buyers"
            icon={<Users className="h-4 w-4" />}
          />
          <KPICard
            label="Avg Contacts"
            value={kpis.avgContactsPerBuyer.toFixed(1)}
            subtitle="per buyer"
          />
          <KPICard
            label="Fee Agreements"
            value={formatInt(kpis.buyersWithFeeAgreement)}
            subtitle={`${kpis.feeAgreementPct.toFixed(1)}% of universe`}
            icon={<FileCheck className="h-4 w-4" />}
          />
          <KPICard
            label="Depth ≥3"
            value={formatInt(kpis.buyersWithMultipleContacts)}
            subtitle="buyers with 3+ contacts"
          />
          <KPICard
            label="No Contacts"
            value={formatInt(buyersWithNoContacts)}
            subtitle="coverage gap"
            highlight={buyersWithNoContacts > 0}
            icon={<AlertCircle className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Buyer Type Distribution + Contacts Histogram */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Buyer Type Distribution
            </h3>
            <span className="text-xs text-gray-400">{kpis.totalActive} total</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : kpis.byType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No buyers</p>
          ) : (
            <div className="space-y-3">
              {kpis.byType.map((t) => {
                const pct =
                  kpis.totalActive > 0 ? Math.round((t.count / kpis.totalActive) * 100) : 0;
                const color = BUYER_TYPE_COLORS[t.type] || '#94a3b8';
                return (
                  <div key={t.type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-700">{t.label}</span>
                      </div>
                      <span className="font-medium">
                        {t.count} <span className="text-gray-400">({pct}%)</span>
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
              Contacts per Buyer
            </h3>
            <span className="text-xs text-gray-400">Depth distribution</span>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex items-end justify-around h-40 gap-2 pt-4">
              {contactsHistogram.map((b) => {
                const heightPct = (b.count / maxHistCount) * 100;
                return (
                  <div
                    key={b.label}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                  >
                    <span className="text-xs font-medium text-gray-800">{b.count}</span>
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: '2px' }}
                    />
                    <span className="text-[10px] text-gray-500">{b.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Buyer Universe Growth */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Buyer Universe Growth
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <TrendingUp className="h-3 w-3" />
            <span>12 weeks</span>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : growthSeries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No new buyers in the last 12 weeks
          </p>
        ) : (
          <div className="flex items-end h-32 gap-2">
            {growthSeries.map((p) => {
              const heightPct = (p.count / maxGrowth) * 100;
              return (
                <div key={p.week} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-medium text-gray-700">{p.count}</span>
                  <div
                    className="w-full bg-cyan-500 rounded-t"
                    style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: '2px' }}
                  />
                  <span className="text-[9px] text-gray-400">
                    {new Date(p.week).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
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
  highlight,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        highlight ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}
