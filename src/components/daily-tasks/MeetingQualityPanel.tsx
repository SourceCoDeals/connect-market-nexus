import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Brain, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingQualityMetrics } from '@/types/daily-tasks';

interface MeetingQualityPanelProps {
  metrics: MeetingQualityMetrics[];
}

export function MeetingQualityPanel({ metrics }: MeetingQualityPanelProps) {
  // Compute aggregate insights
  const insights = useMemo(() => {
    if (metrics.length === 0)
      return {
        avgConfidence: 0,
        avgNeedsReview: 0,
        avgTasksPerMeeting: 0,
        avgAssigneeMatch: 0,
        avgDuration: null as number | null,
        alerts: [] as string[],
        trend: 'stable' as 'up' | 'down' | 'stable',
      };

    const avgConfidence =
      metrics.reduce((s, m) => s + m.extraction_confidence_rate, 0) / metrics.length;
    const avgNeedsReview = metrics.reduce((s, m) => s + m.needs_review_rate, 0) / metrics.length;
    const avgTasksPerMeeting =
      metrics.reduce((s, m) => s + m.tasks_per_meeting, 0) / metrics.length;
    const avgAssigneeMatch =
      metrics.reduce((s, m) => s + m.assignee_match_rate, 0) / metrics.length;

    const durationsWithValue = metrics.filter((m) => m.meeting_duration_minutes != null);
    const avgDuration =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce((s, m) => s + m.meeting_duration_minutes!, 0) /
          durationsWithValue.length
        : null;

    // Generate alerts
    const alerts: string[] = [];

    // Rolling 7-day review rate check
    const recent7 = metrics.slice(0, 7);
    if (recent7.length >= 3) {
      const recentReviewRate =
        recent7.reduce((s, m) => s + m.needs_review_rate, 0) / recent7.length;
      if (recentReviewRate > 25) {
        alerts.push(
          `Meeting clarity has dropped — ${recentReviewRate.toFixed(0)}% of tasks required manual review this week. Consider assigning tasks more explicitly during standups.`,
        );
      }
    }

    // Task volume vs completion capacity
    if (metrics.length >= 7) {
      const recentAvg = metrics.slice(0, 7).reduce((s, m) => s + m.tasks_per_meeting, 0) / 7;
      const olderAvg =
        metrics.slice(7, 14).reduce((s, m) => s + m.tasks_per_meeting, 0) /
        Math.max(metrics.slice(7, 14).length, 1);
      if (recentAvg > olderAvg * 1.3 && olderAvg > 0) {
        alerts.push(
          `Task volume is growing faster than completion capacity. Consider reducing scope or adding resources.`,
        );
      }
    }

    // Confidence trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (metrics.length >= 6) {
      const recentConf =
        metrics.slice(0, 3).reduce((s, m) => s + m.extraction_confidence_rate, 0) / 3;
      const olderConf =
        metrics.slice(3, 6).reduce((s, m) => s + m.extraction_confidence_rate, 0) / 3;
      if (recentConf > olderConf + 5) trend = 'up';
      if (recentConf < olderConf - 5) trend = 'down';
    }

    return {
      avgConfidence,
      avgNeedsReview,
      avgTasksPerMeeting,
      avgAssigneeMatch,
      avgDuration,
      alerts,
      trend,
    };
  }, [metrics]);

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          No meeting data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {insights.alerts.length > 0 && (
        <div className="space-y-2">
          {insights.alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {insights.avgConfidence.toFixed(0)}%
                </p>
                {insights.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                {insights.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
              </div>
              <p className="text-xs text-muted-foreground">Extraction Confidence</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">
                {insights.avgNeedsReview.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Needs Review Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">
                {insights.avgTasksPerMeeting.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">Tasks per Meeting</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">
                {insights.avgAssigneeMatch.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Assignee Match Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Extraction Confidence Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {metrics
              .slice()
              .reverse()
              .map((m) => {
                const height = m.extraction_confidence_rate;
                return (
                  <div
                    key={m.meeting_id}
                    className="flex-1 flex flex-col justify-end items-center"
                    title={`${m.meeting_date}: ${m.extraction_confidence_rate.toFixed(0)}% confidence, ${m.tasks_per_meeting} tasks`}
                  >
                    <div
                      className={cn(
                        'w-full rounded-t min-w-[4px]',
                        height >= 80
                          ? 'bg-green-400'
                          : height >= 60
                            ? 'bg-amber-400'
                            : 'bg-red-400',
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                );
              })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{metrics[metrics.length - 1]?.meeting_date}</span>
            <span>{metrics[0]?.meeting_date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Meeting-by-meeting table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Meeting History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-6 gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
              <span>Date</span>
              <span>Tasks</span>
              <span>Confidence</span>
              <span>Needs Review</span>
              <span>Assignee Match</span>
              <span>Duration</span>
            </div>
            {metrics.map((m) => (
              <div
                key={m.meeting_id}
                className="grid grid-cols-6 gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted/50"
              >
                <span>{m.meeting_date}</span>
                <span className="tabular-nums">{m.tasks_per_meeting}</span>
                <span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4',
                      m.extraction_confidence_rate >= 80
                        ? 'border-green-300 text-green-700'
                        : m.extraction_confidence_rate >= 60
                          ? 'border-amber-300 text-amber-700'
                          : 'border-red-300 text-red-700',
                    )}
                  >
                    {m.extraction_confidence_rate.toFixed(0)}%
                  </Badge>
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    m.needs_review_rate > 25 ? 'text-red-600 font-medium' : '',
                  )}
                >
                  {m.needs_review_rate.toFixed(0)}%
                </span>
                <span className="tabular-nums">{m.assignee_match_rate.toFixed(0)}%</span>
                <span className="tabular-nums text-muted-foreground">
                  {m.meeting_duration_minutes != null ? `${m.meeting_duration_minutes}m` : '—'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
