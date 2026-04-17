/**
 * TeamTab.tsx
 *
 * Phase 6 — Team Performance. Answers "who's driving output and where are the
 * bottlenecks?".
 */
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, Users, UserX } from 'lucide-react';
import { useTeamMetrics, type TeamRow } from './useTeamMetrics';
import type { Timeframe } from '../useDashboardData';

interface TeamTabProps {
  timeframe: Timeframe;
}

type SortKey =
  | 'calls'
  | 'connectRate'
  | 'emailsSent'
  | 'tasksCompleted'
  | 'tasksOverdue'
  | 'dealsOwned';

function formatInt(n: number): string {
  return n.toLocaleString();
}

export function TeamTab({ timeframe }: TeamTabProps) {
  const { loading, kpis, teamRows } = useTeamMetrics(timeframe);
  const [sortBy, setSortBy] = useState<SortKey>('calls');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...teamRows].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

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
            label="Tasks Completed"
            value={formatInt(kpis.tasksCompleted)}
            subtitle="in period"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <KPICard
            label="Tasks Overdue"
            value={formatInt(kpis.tasksOverdue)}
            subtitle="need attention"
            icon={<AlertCircle className="h-4 w-4" />}
            highlight={kpis.tasksOverdue > 0}
          />
          <KPICard
            label="Deals Assigned"
            value={formatInt(kpis.dealsAssigned)}
            subtitle="active pipeline"
            icon={<Users className="h-4 w-4" />}
          />
          <KPICard
            label="Unassigned"
            value={formatInt(kpis.unassignedDeals)}
            subtitle="no owner"
            icon={<UserX className="h-4 w-4" />}
            highlight={kpis.unassignedDeals > 0}
          />
        </div>
      )}

      {/* Per-admin table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Per-Admin Activity
          </h3>
          <div className="flex items-center gap-3">
            {kpis.unattributedEmails > 0 && (
              <span
                className="text-[11px] text-amber-600"
                title="Emails whose sender address couldn't be matched to an admin profile. Usually means the admin's profile email doesn't match the SmartLead from_address."
              >
                {formatInt(kpis.unattributedEmails)} unattributed
              </span>
            )}
            <span className="text-xs text-gray-400">{sorted.length} active members</span>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No activity in period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b">
                  <th className="pb-2 pr-3">Admin</th>
                  <SortableTh
                    label="Deals Owned"
                    active={sortBy === 'dealsOwned'}
                    dir={sortDir}
                    onClick={() => toggleSort('dealsOwned')}
                  />
                  <SortableTh
                    label="Calls"
                    active={sortBy === 'calls'}
                    dir={sortDir}
                    onClick={() => toggleSort('calls')}
                  />
                  <SortableTh
                    label="Connect %"
                    active={sortBy === 'connectRate'}
                    dir={sortDir}
                    onClick={() => toggleSort('connectRate')}
                  />
                  <SortableTh
                    label="Emails"
                    active={sortBy === 'emailsSent'}
                    dir={sortDir}
                    onClick={() => toggleSort('emailsSent')}
                  />
                  <SortableTh
                    label="Tasks Done"
                    active={sortBy === 'tasksCompleted'}
                    dir={sortDir}
                    onClick={() => toggleSort('tasksCompleted')}
                  />
                  <SortableTh
                    label="Overdue"
                    active={sortBy === 'tasksOverdue'}
                    dir={sortDir}
                    onClick={() => toggleSort('tasksOverdue')}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <TeamTableRow key={r.userId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamTableRow({ row }: { row: TeamRow }) {
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2.5 pr-3 font-medium text-gray-900">{row.name}</td>
      <td className="py-2.5 pr-3 text-right text-gray-700">{row.dealsOwned}</td>
      <td className="py-2.5 pr-3 text-right text-gray-700">{row.calls}</td>
      <td className="py-2.5 pr-3 text-right">
        <span
          className={
            row.connectRate >= 20
              ? 'text-emerald-600 font-medium'
              : row.connectRate >= 10
                ? 'text-amber-600'
                : 'text-gray-500'
          }
        >
          {row.connectRate.toFixed(1)}%
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right text-gray-700">{row.emailsSent}</td>
      <td className="py-2.5 pr-3 text-right text-emerald-700">{row.tasksCompleted}</td>
      <td className="py-2.5 pr-3 text-right">
        <span className={row.tasksOverdue > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
          {row.tasksOverdue}
        </span>
      </td>
    </tr>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <th className="pb-2 pr-3 text-right">
      <button
        type="button"
        onClick={onClick}
        className={`text-[11px] uppercase tracking-wider hover:text-gray-800 ${
          active ? 'text-gray-800' : 'text-gray-500'
        }`}
      >
        {label} {active && (dir === 'desc' ? '↓' : '↑')}
      </button>
    </th>
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
