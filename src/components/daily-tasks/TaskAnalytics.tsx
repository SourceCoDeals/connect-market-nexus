import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTaskAnalytics, useTeamAnalytics } from '@/hooks/daily-tasks/use-task-analytics';
import { useTeamMembers } from '@/hooks/daily-tasks/use-daily-tasks';
import type { TaskTimeRange } from '@/types/daily-tasks';
import { TASK_TYPE_CONFIG } from '@/types/daily-tasks';
import { CheckCircle2, Clock, AlertTriangle, Trophy, Users } from 'lucide-react';

interface TaskAnalyticsProps {
  timeRange: TaskTimeRange;
  selectedMemberId?: string | null;
}

export function TaskAnalytics({ timeRange, selectedMemberId }: TaskAnalyticsProps) {
  const { data: individual, isLoading: indLoading } = useTaskAnalytics({
    assigneeId: selectedMemberId,
    timeRange,
  });
  const { data: team, isLoading: teamLoading } = useTeamAnalytics(timeRange);
  const { data: members } = useTeamMembers();

  const loading = indLoading || teamLoading;

  const memberName = (id: string) => {
    const m = members?.find((m) => m.id === id);
    return m?.name || 'Unknown';
  };

  return (
    <div className="space-y-5">
      {/* ── Individual Scorecard ── */}
      {selectedMemberId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-4">
            Individual Scorecard
          </h3>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : individual ? (
            <div className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-green-50 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-green-700">
                    Completion Rate
                  </p>
                  <p className="text-2xl font-bold text-green-800 mt-1">
                    {individual.completion_rate}%
                  </p>
                </div>
                <div className="rounded-lg border bg-blue-50 px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                    <p className="text-[10px] uppercase tracking-widest text-blue-700">Completed</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-800 mt-1">
                    {individual.total_completed}/{individual.total_assigned}
                  </p>
                </div>
                <div className="rounded-lg border bg-red-50 px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-600" />
                    <p className="text-[10px] uppercase tracking-widest text-red-700">Overdue</p>
                  </div>
                  <p className="text-2xl font-bold text-red-800 mt-1">{individual.total_overdue}</p>
                </div>
                <div className="rounded-lg border bg-gray-50 px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-600" />
                    <p className="text-[10px] uppercase tracking-widest text-gray-700">Avg Hours</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {individual.avg_completion_hours ?? '—'}
                  </p>
                </div>
              </div>

              {/* Task Type Breakdown */}
              {individual.by_task_type && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    By Task Type
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(individual.by_task_type).map(([type, stats]) => {
                      const config =
                        TASK_TYPE_CONFIG[type as keyof typeof TASK_TYPE_CONFIG] ||
                        TASK_TYPE_CONFIG.other;
                      return (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${config.bgColor} ${config.color} border-0`}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">
                              {stats.completed}/{stats.total}
                            </span>
                            <span className="font-medium w-12 text-right">{stats.rate}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completion Trend */}
              {individual.daily_trend && individual.daily_trend.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Completion Trend
                  </p>
                  <CompletionTrend data={individual.daily_trend} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No task data for this period</p>
          )}
        </div>
      )}

      {/* ── Team Dashboard ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Team Dashboard
          </h3>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : team ? (
          <div className="space-y-4">
            {/* Team KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-gray-900 text-white px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Team Rate</p>
                <p className="text-2xl font-bold mt-1">{team.team_completion_rate}%</p>
              </div>
              <div className="rounded-lg border bg-blue-50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-blue-700">Total Tasks</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">{team.total_tasks}</p>
              </div>
              <div className="rounded-lg border bg-green-50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-green-700">Completed</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{team.total_completed}</p>
              </div>
              <div className="rounded-lg border bg-red-50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-widest text-red-700">Overdue</p>
                <p className="text-2xl font-bold text-red-800 mt-1">{team.total_overdue}</p>
              </div>
            </div>

            {/* Leaderboard */}
            {team.leaderboard && team.leaderboard.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Leaderboard
                  </p>
                </div>
                <div className="space-y-2">
                  {team.leaderboard.map((entry, i) => (
                    <div key={entry.assignee_id} className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0
                            ? 'bg-amber-100 text-amber-700'
                            : i === 1
                              ? 'bg-gray-200 text-gray-700'
                              : i === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {memberName(entry.assignee_id)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${entry.rate}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 w-8 text-right">
                            {entry.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-gray-800">{entry.completed}</span>
                        <span className="text-xs text-gray-500">/{entry.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overdue Hotspots */}
            {team.overdue_by_type && Object.keys(team.overdue_by_type).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Overdue Hotspots
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(team.overdue_by_type).map(([type, count]) => {
                    const config =
                      TASK_TYPE_CONFIG[type as keyof typeof TASK_TYPE_CONFIG] ||
                      TASK_TYPE_CONFIG.other;
                    return (
                      <Badge
                        key={type}
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-200"
                      >
                        {config.label}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">No team data for this period</p>
        )}
      </div>
    </div>
  );
}

// Simple SVG completion trend chart
function CompletionTrend({
  data,
}: {
  data: { date: string; assigned: number; completed: number; rate: number }[];
}) {
  if (data.length === 0) return null;

  const W = 400;
  const H = 100;
  const PL = 10;
  const PR = 10;
  const PT = 10;
  const PB = 20;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const maxRate = 100;
  const points = data.map((d, i) => ({
    x: PL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PT + chartH - (d.rate / maxRate) * chartH,
    rate: d.rate,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {[0, 50, 100].map((pct) => {
        const y = PT + chartH - (pct / maxRate) * chartH;
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 2} y={y + 3} textAnchor="end" className="fill-gray-400" fontSize="7">
              {pct}%
            </text>
          </g>
        );
      })}
      {/* Line */}
      <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      {/* Points */}
      {points.map((p) => (
        <circle
          key={`${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="white"
          stroke="#2563eb"
          strokeWidth="1.5"
        />
      ))}
      {/* X labels */}
      {points
        .filter(
          (_, i) => i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0,
        )
        .map((p) => (
          <text
            key={`label-${p.date}`}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize="7"
          >
            {new Date(p.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </text>
        ))}
    </svg>
  );
}
