import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, subDays } from "date-fns";

interface DecisionRecord {
  action: 'approved' | 'passed';
  created_at: string;
  composite_score?: number;
  pass_category?: string | null;
}

interface DecisionHistoryChartProps {
  decisions: DecisionRecord[];
  daysBack?: number;
  className?: string;
}

export function DecisionHistoryChart({ 
  decisions, 
  daysBack = 30,
  className 
}: DecisionHistoryChartProps) {
  const { chartData, summary } = useMemo(() => {
    const startDate = subDays(new Date(), daysBack);
    
    // Initialize all days
    const dayMap = new Map<string, { approved: number; passed: number; avgScore: number; scores: number[] }>();
    for (let i = daysBack - 1; i >= 0; i--) {
      const dateKey = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dayMap.set(dateKey, { approved: 0, passed: 0, avgScore: 0, scores: [] });
    }
    
    // Aggregate decisions by day
    const recentDecisions = decisions.filter(d => new Date(d.created_at) >= startDate);
    
    recentDecisions.forEach(decision => {
      const dateKey = format(parseISO(decision.created_at), 'yyyy-MM-dd');
      const day = dayMap.get(dateKey);
      if (day) {
        if (decision.action === 'approved') {
          day.approved++;
        } else {
          day.passed++;
        }
        if (decision.composite_score) {
          day.scores.push(decision.composite_score);
        }
      }
    });
    
    // Calculate averages and build chart data
    const data = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date: format(parseISO(date), 'MMM d'),
        fullDate: date,
        approved: values.approved,
        passed: values.passed,
        total: values.approved + values.passed,
        avgScore: values.scores.length > 0 
          ? Math.round(values.scores.reduce((a, b) => a + b, 0) / values.scores.length)
          : null,
        approvalRate: values.approved + values.passed > 0
          ? Math.round((values.approved / (values.approved + values.passed)) * 100)
          : null,
      }));
    
    // Calculate summary stats
    const totalApproved = recentDecisions.filter(d => d.action === 'approved').length;
    const totalPassed = recentDecisions.filter(d => d.action === 'passed').length;
    const total = totalApproved + totalPassed;
    
    // Pass category breakdown
    const passCategories = recentDecisions
      .filter(d => d.action === 'passed' && d.pass_category)
      .reduce((acc, d) => {
        acc[d.pass_category!] = (acc[d.pass_category!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topPassCategory = Object.entries(passCategories)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      chartData: data,
      summary: {
        total,
        approved: totalApproved,
        passed: totalPassed,
        approvalRate: total > 0 ? ((totalApproved / total) * 100).toFixed(1) : '0',
        topPassCategory: topPassCategory ? topPassCategory[0] : null,
        trend: data.length >= 7 
          ? calculateTrend(data.slice(-7).map(d => d.approvalRate).filter(Boolean) as number[])
          : 'stable'
      }
    };
  }, [decisions, daysBack]);
  
  if (decisions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          No decision history available
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Decision History
              {summary.trend === 'up' && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Improving
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Approve/pass decisions over {daysBack} days
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">{summary.approved}</span>
              <span className="text-muted-foreground">approved</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-slate-400" />
              <span className="font-medium">{summary.passed}</span>
              <span className="text-muted-foreground">passed</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="approved"
                name="Approved"
                stroke="hsl(var(--primary))"
                fill="url(#approvedGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="passed"
                name="Passed"
                stroke="hsl(var(--muted-foreground))"
                fill="url(#passedGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{summary.approvalRate}%</p>
            <p className="text-xs text-muted-foreground">Approval Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total Decisions</p>
          </div>
          <div>
            <p className="text-lg font-medium text-muted-foreground capitalize">
              {summary.topPassCategory || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Top Pass Reason</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 3) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const diff = secondAvg - firstAvg;
  
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

export default DecisionHistoryChart;
