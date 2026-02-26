import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMeetingQualityAnalytics } from '@/hooks/daily-tasks/use-task-analytics';
import type { TaskTimeRange } from '@/types/daily-tasks';
import { Mic, AlertTriangle, CheckCircle2, Users } from 'lucide-react';

interface MeetingQualityProps {
  timeRange: TaskTimeRange;
}

export function MeetingQuality({ timeRange }: MeetingQualityProps) {
  const { data, isLoading } = useMeetingQualityAnalytics(timeRange);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Meeting Quality
        </h3>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !data || data.total_meetings === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No standup meetings processed yet</p>
      ) : (
        <div className="space-y-4">
          {/* Alerts */}
          {data.needs_review_rate > 25 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Meeting clarity has dropped</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {data.needs_review_rate.toFixed(0)}% of tasks required manual review. Consider
                  assigning tasks more explicitly during standups.
                </p>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-1">
                <Mic className="h-3 w-3 text-gray-500" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Meetings</p>
              </div>
              <p className="text-xl font-bold text-gray-800 mt-1">{data.total_meetings}</p>
            </div>
            <div className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500">
                  Avg Tasks/Meeting
                </p>
              </div>
              <p className="text-xl font-bold text-gray-800 mt-1">{data.avg_tasks_per_meeting}</p>
            </div>
            <div className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Confidence</p>
              </div>
              <p className="text-xl font-bold text-gray-800 mt-1">
                {data.avg_extraction_confidence?.toFixed(0) ?? '—'}%
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-purple-500" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Match Rate</p>
              </div>
              <p className="text-xl font-bold text-gray-800 mt-1">
                {data.assignee_match_rate?.toFixed(0) ?? '—'}%
              </p>
            </div>
          </div>

          {/* Confidence Breakdown */}
          {data.confidence_breakdown && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Extraction Confidence
              </p>
              <div className="flex items-center gap-2">
                {[
                  {
                    label: 'High',
                    value: data.confidence_breakdown.high,
                    color: 'bg-green-500',
                  },
                  {
                    label: 'Medium',
                    value: data.confidence_breakdown.medium,
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Low',
                    value: data.confidence_breakdown.low,
                    color: 'bg-red-500',
                  },
                ].map((b) => {
                  const total =
                    data.confidence_breakdown.high +
                    data.confidence_breakdown.medium +
                    data.confidence_breakdown.low;
                  const pct = total > 0 ? (b.value / total) * 100 : 0;
                  return (
                    <div key={b.label} className="flex-1">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-600">{b.label}</span>
                        <span className="text-gray-500">
                          {b.value} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div
                          className={`h-full rounded-full ${b.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meetings Trend */}
          {data.meetings_trend && data.meetings_trend.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Meeting Trend
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b">
                      <th className="pb-1.5 text-left">Date</th>
                      <th className="pb-1.5 text-center">Tasks</th>
                      <th className="pb-1.5 text-center">Confidence</th>
                      <th className="pb-1.5 text-center">Unassigned</th>
                      <th className="pb-1.5 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meetings_trend.map((m) => (
                      <tr key={m.date} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-700">
                          {new Date(m.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-1.5 text-center font-medium">{m.tasks_extracted}</td>
                        <td className="py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              (m.confidence ?? 0) >= 80
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : (m.confidence ?? 0) >= 50
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {m.confidence?.toFixed(0) ?? '—'}%
                          </Badge>
                        </td>
                        <td className="py-1.5 text-center text-gray-500">{m.unassigned}</td>
                        <td className="py-1.5 text-right text-gray-500">
                          {m.duration_minutes ? `${m.duration_minutes}m` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Needs Review Rate */}
          <div className="flex items-center justify-between text-xs border-t pt-3">
            <span className="text-gray-500">Needs Review Rate (7d rolling)</span>
            <Badge
              variant="outline"
              className={
                data.needs_review_rate > 25
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }
            >
              {data.needs_review_rate.toFixed(1)}%
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
