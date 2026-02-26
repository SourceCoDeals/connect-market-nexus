import { Link } from 'react-router-dom';
import { useTimeframe } from '@/hooks/use-timeframe';
import { TimeframeSelector } from '@/components/filters/TimeframeSelector';
import {
  useTaskAnalytics,
  useTeamScorecards,
  useMeetingQualityMetrics,
  useTaskVolumeTrend,
} from '@/hooks/useTaskAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Users,
  Trophy,
  AlertTriangle,
  TrendingUp,
  Target,
  Brain,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_TYPE_LABELS } from '@/types/daily-tasks';
import type { TaskType, TeamMemberScorecard } from '@/types/daily-tasks';
import { MeetingQualityPanel } from '@/components/daily-tasks/MeetingQualityPanel';

const DailyTaskAnalytics = () => {
  const { timeframe, setTimeframe, dateRange } = useTimeframe('last_30d');
  const dateFrom = dateRange.from?.toISOString() || null;
  const dateTo = dateRange.to?.toISOString() || null;

  const { data: analytics, isLoading: loadingAnalytics } = useTaskAnalytics(dateFrom, dateTo);
  const { data: scorecards, isLoading: loadingScorecards } = useTeamScorecards(dateFrom, dateTo);
  const { data: volumeTrend } = useTaskVolumeTrend(dateFrom, dateTo);
  const { data: meetingMetrics } = useMeetingQualityMetrics(dateFrom, dateTo);

  return (
    <div className="p-6 space-y-5 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/remarketing/daily-tasks">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Task Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Team performance, completion trends, and meeting quality insights.
            </p>
          </div>
        </div>
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Team Overview
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Individual Scorecards
          </TabsTrigger>
          <TabsTrigger value="meeting" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Meeting Quality
          </TabsTrigger>
        </TabsList>

        {/* ─── Team Overview Tab ─── */}
        <TabsContent value="team" className="space-y-4">
          {loadingAnalytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Target className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.total_assigned}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Tasks</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.completion_rate.toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Completion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-700" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{analytics.total_overdue}</p>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.avg_time_to_complete_hours != null
                            ? `${analytics.avg_time_to_complete_hours.toFixed(1)}h`
                            : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg. Completion Time</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Task volume trend */}
              {volumeTrend && volumeTrend.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Task Volume Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-32">
                      {volumeTrend.slice(-30).map((day) => {
                        const maxCreated = Math.max(...volumeTrend.map((d) => d.created));
                        const height = maxCreated > 0 ? (day.created / maxCreated) * 100 : 0;
                        const completedHeight =
                          maxCreated > 0 ? (day.completed / maxCreated) * 100 : 0;
                        return (
                          <div
                            key={day.date}
                            className="flex-1 flex flex-col justify-end items-center gap-0.5"
                            title={`${day.date}: ${day.created} created, ${day.completed} completed`}
                          >
                            <div className="w-full relative">
                              <div
                                className="w-full bg-blue-200 rounded-t"
                                style={{ height: `${height}%`, minHeight: day.created > 0 ? 4 : 0 }}
                              />
                              <div
                                className="w-full bg-green-400 rounded-t absolute bottom-0"
                                style={{
                                  height: `${completedHeight}%`,
                                  minHeight: day.completed > 0 ? 2 : 0,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-200 rounded" /> Created
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded" /> Completed
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Task type breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Breakdown by Task Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.by_task_type).map(([type, counts]) => {
                      const total = counts.assigned;
                      const completionRate = total > 0 ? (counts.completed / total) * 100 : 0;
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{TASK_TYPE_LABELS[type as TaskType] || type}</span>
                            <span className="text-xs text-muted-foreground">
                              {counts.completed}/{total} ({completionRate.toFixed(0)}%)
                              {counts.overdue > 0 && (
                                <span className="text-red-600 ml-1">{counts.overdue} overdue</span>
                              )}
                            </span>
                          </div>
                          <Progress value={completionRate} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Leaderboard */}
              {scorecards && scorecards.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Team Leaderboard
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {scorecards.map((sc, i) => (
                        <div
                          key={sc.member_id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <span
                            className={cn(
                              'text-lg font-bold w-8 text-center tabular-nums',
                              i === 0 && 'text-amber-500',
                              i === 1 && 'text-gray-400',
                              i === 2 && 'text-amber-700',
                            )}
                          >
                            #{i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{sc.member_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sc.total_completed}/{sc.total_assigned} tasks
                              {sc.total_overdue > 0 && (
                                <span className="text-red-600"> ({sc.total_overdue} overdue)</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {sc.completion_rate.toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">completion</p>
                          </div>
                          <div className="w-24">
                            <Progress value={sc.completion_rate} className="h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ─── Individual Scorecards Tab ─── */}
        <TabsContent value="individual" className="space-y-4">
          {loadingScorecards ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : scorecards && scorecards.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {scorecards.map((sc) => (
                <ScorecardCard key={sc.member_id} scorecard={sc} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No task data available for the selected period.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Meeting Quality Tab ─── */}
        <TabsContent value="meeting" className="space-y-4">
          <MeetingQualityPanel metrics={meetingMetrics || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Scorecard Card Component ───

function ScorecardCard({ scorecard: sc }: { scorecard: TeamMemberScorecard }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{sc.member_name}</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              sc.completion_rate >= 80
                ? 'border-green-300 text-green-700'
                : sc.completion_rate >= 50
                  ? 'border-amber-300 text-amber-700'
                  : 'border-red-300 text-red-700',
            )}
          >
            {sc.completion_rate.toFixed(0)}% completion
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{sc.total_assigned}</p>
            <p className="text-[10px] text-muted-foreground">Assigned</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-green-600">{sc.total_completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-red-600">{sc.total_overdue}</p>
            <p className="text-[10px] text-muted-foreground">Overdue</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">
              {sc.avg_time_to_complete_hours != null
                ? `${sc.avg_time_to_complete_hours.toFixed(1)}h`
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg. Time</p>
          </div>
        </div>

        {/* Priority discipline */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Priority Discipline</span>
            <span className="font-medium">{sc.priority_discipline_score.toFixed(0)}%</span>
          </div>
          <Progress value={sc.priority_discipline_score} className="h-1.5" />
        </div>

        {/* Completion trend sparkline */}
        {sc.completion_trend.length > 1 && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Completion Trend</span>
            <div className="flex items-end gap-0.5 h-8">
              {sc.completion_trend.slice(-14).map((point) => (
                <div
                  key={point.date}
                  className={cn(
                    'flex-1 rounded-t min-w-[3px]',
                    point.rate >= 80
                      ? 'bg-green-400'
                      : point.rate >= 50
                        ? 'bg-amber-400'
                        : 'bg-red-400',
                  )}
                  style={{ height: `${Math.max(point.rate, 4)}%` }}
                  title={`${point.date}: ${point.rate.toFixed(0)}%`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Task type breakdown */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">By Task Type</span>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(sc.by_task_type)
              .sort(([, a], [, b]) => b.assigned - a.assigned)
              .slice(0, 4)
              .map(([type, counts]) => (
                <div
                  key={type}
                  className="flex items-center justify-between text-[11px] px-1.5 py-0.5 bg-muted/50 rounded"
                >
                  <span className="truncate">{TASK_TYPE_LABELS[type as TaskType] || type}</span>
                  <span className="text-muted-foreground ml-1">
                    {counts.completed}/{counts.assigned}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DailyTaskAnalytics;
