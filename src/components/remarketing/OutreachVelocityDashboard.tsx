import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Timer, 
  Zap, 
  TrendingUp,
  TrendingDown,
  Target,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';

interface VelocityTrend {
  date: string;
  avgDays: number;
  deals: number;
}

interface StageVelocity {
  stage: string;
  avgDays: number;
  benchmark: number;
  deals: number;
  conversionRate: number;
}

interface OutreachVelocityDashboardProps {
  velocityTrends: VelocityTrend[];
  stageVelocities: StageVelocity[];
  summary: {
    avgApprovalToContact: number;
    avgContactToResponse: number;
    avgResponseToMeeting: number;
    avgMeetingToClose: number;
    totalAvgDays: number;
    responseRate: number;
    meetingRate: number;
  };
  benchmarks?: {
    approvalToContact: number;
    contactToResponse: number;
    responseToMeeting: number;
    meetingToClose: number;
    total: number;
  };
  className?: string;
}

const DEFAULT_BENCHMARKS = {
  approvalToContact: 2,
  contactToResponse: 5,
  responseToMeeting: 7,
  meetingToClose: 30,
  total: 44
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3">
        <p className="font-semibold">{label}</p>
        <p className="text-sm">
          <span className="text-muted-foreground">Avg Days:</span>{' '}
          <span className="font-medium">{payload[0].value.toFixed(1)}</span>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Deals:</span>{' '}
          <span className="font-medium">{payload[0].payload.deals}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const OutreachVelocityDashboard = ({
  velocityTrends,
  stageVelocities,
  summary,
  benchmarks = DEFAULT_BENCHMARKS,
  className
}: OutreachVelocityDashboardProps) => {
  const getPerformanceStatus = (actual: number, benchmark: number) => {
    const ratio = actual / benchmark;
    if (ratio <= 0.8) return { status: 'excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (ratio <= 1.0) return { status: 'good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (ratio <= 1.3) return { status: 'average', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { status: 'slow', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const totalPerformance = getPerformanceStatus(summary.totalAvgDays, benchmarks.total);

  const stages = [
    { 
      label: 'Approval → Contact', 
      value: summary.avgApprovalToContact, 
      benchmark: benchmarks.approvalToContact,
      icon: Zap
    },
    { 
      label: 'Contact → Response', 
      value: summary.avgContactToResponse, 
      benchmark: benchmarks.contactToResponse,
      icon: Clock
    },
    { 
      label: 'Response → Meeting', 
      value: summary.avgResponseToMeeting, 
      benchmark: benchmarks.responseToMeeting,
      icon: Target
    },
    { 
      label: 'Meeting → Close', 
      value: summary.avgMeetingToClose, 
      benchmark: benchmarks.meetingToClose,
      icon: CheckCircle2
    },
  ];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Timer className="h-4 w-4" />
              <span className="text-sm">Total Cycle Time</span>
            </div>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", totalPerformance.color)}>
                {summary.totalAvgDays.toFixed(0)}
              </p>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Benchmark: {benchmarks.total} days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm">Avg to First Contact</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{summary.avgApprovalToContact.toFixed(1)}</p>
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs mt-1",
                getPerformanceStatus(summary.avgApprovalToContact, benchmarks.approvalToContact).bg,
                getPerformanceStatus(summary.avgApprovalToContact, benchmarks.approvalToContact).color
              )}
            >
              {getPerformanceStatus(summary.avgApprovalToContact, benchmarks.approvalToContact).status}
            </Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Response Rate</span>
            </div>
            <p className="text-2xl font-bold">{summary.responseRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">
              Of contacted buyers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Meeting Conversion</span>
            </div>
            <p className="text-2xl font-bold">{summary.meetingRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">
              Of responses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Velocity Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Velocity Trend</CardTitle>
          <CardDescription>
            Average days from approval to close over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {velocityTrends.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityTrends}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine 
                    y={benchmarks.total} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="3 3" 
                    label={{ value: 'Benchmark', position: 'right', fontSize: 10 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgDays" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No velocity data yet</p>
                <p className="text-sm">Complete some deals to see trends</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stage-by-Stage Velocity</CardTitle>
          <CardDescription>
            Time spent in each stage vs. benchmark
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stages.map((stage, index) => {
              const performance = getPerformanceStatus(stage.value, stage.benchmark);
              const Icon = stage.icon;
              
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", performance.color)} />
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-bold", performance.color)}>
                        {stage.value.toFixed(1)} days
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / {stage.benchmark} benchmark
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={Math.min((stage.value / (stage.benchmark * 2)) * 100, 100)} 
                      className="h-2"
                    />
                    {/* Benchmark indicator */}
                    <div 
                      className="absolute top-0 w-0.5 h-4 bg-muted-foreground -translate-y-1"
                      style={{ left: '50%' }}
                    />
                  </div>
                  {index < stages.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Optimization Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary.avgApprovalToContact > benchmarks.approvalToContact && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-amber-800">Slow Initial Outreach</p>
                <p className="text-sm text-amber-700">
                  You're taking {summary.avgApprovalToContact.toFixed(1)} days to contact approved buyers. 
                  Aim for under {benchmarks.approvalToContact} days to improve response rates.
                </p>
              </div>
            )}
            
            {summary.responseRate < 30 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-medium text-blue-800">Low Response Rate</p>
                <p className="text-sm text-blue-700">
                  Only {summary.responseRate.toFixed(0)}% of contacted buyers respond. 
                  Consider improving email templates or targeting higher-tier matches.
                </p>
              </div>
            )}
            
            {summary.avgMeetingToClose > benchmarks.meetingToClose * 1.5 && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="font-medium text-purple-800">Long Close Cycle</p>
                <p className="text-sm text-purple-700">
                  Deals take {summary.avgMeetingToClose.toFixed(0)} days to close after meetings. 
                  Consider streamlining the due diligence process.
                </p>
              </div>
            )}
            
            {summary.avgApprovalToContact <= benchmarks.approvalToContact &&
             summary.responseRate >= 30 &&
             summary.avgMeetingToClose <= benchmarks.meetingToClose && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">Great Performance!</p>
                <p className="text-sm text-green-700">
                  Your outreach velocity is meeting or exceeding benchmarks across all stages.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OutreachVelocityDashboard;
