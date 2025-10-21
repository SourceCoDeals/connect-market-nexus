import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { User } from "@/types";
import { TrendingUp, Calendar, Users, Activity } from "lucide-react";

interface UserGrowthTrendProps {
  users: User[];
  timeRange: number;
}

export function UserGrowthTrend({ users, timeRange }: UserGrowthTrendProps) {
  const growthData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    const now = new Date();
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[key] = 0;
    }
    
    users.forEach(user => {
      const date = new Date(user.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (monthlyData[key] !== undefined) {
        monthlyData[key]++;
      }
    });
    
    const chartData = Object.entries(monthlyData).map(([month, count]) => ({
      month,
      users: count,
    }));
    
    const totalUsers = Object.values(monthlyData).reduce((a, b) => a + b, 0);
    const avgPerMonth = totalUsers / 6;
    const values = Object.values(monthlyData);
    const lastMonth = values[values.length - 1];
    const previousMonth = values[values.length - 2] || 1;
    const momGrowth = ((lastMonth - previousMonth) / previousMonth) * 100;
    
    // Find best month
    const maxCount = Math.max(...values);
    const bestMonthIndex = values.indexOf(maxCount);
    const bestMonth = Object.keys(monthlyData)[bestMonthIndex];
    
    return {
      chartData,
      avgPerMonth,
      momGrowth,
      bestMonth,
      bestMonthCount: maxCount,
      totalSignups: totalUsers,
      velocity: (totalUsers / (6 * 30)).toFixed(1), // users per day
    };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">User Signups Over Time</CardTitle>
          <CardDescription>Monthly signup trends for the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData.chartData}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                <ReferenceLine 
                  y={growthData.avgPerMonth} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Avg', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6 }}
                  fill="url(#userGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Growth Rate (MoM)</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {growthData.momGrowth > 0 ? '+' : ''}{growthData.momGrowth.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs previous month</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Best Month</p>
            </div>
            <p className="text-2xl font-bold">{growthData.bestMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">{growthData.bestMonthCount} signups</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Signup Velocity</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{growthData.velocity}</p>
            <p className="text-xs text-muted-foreground mt-1">users per day</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Total Signups</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{growthData.totalSignups}</p>
            <p className="text-xs text-muted-foreground mt-1">last 6 months</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights Card */}
      <Card className="bg-muted/30 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Growth Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {growthData.momGrowth > 0 && (
            <p className="text-success">
              • Growth accelerating: <span className="font-semibold">+{growthData.momGrowth.toFixed(1)}%</span> vs previous period
            </p>
          )}
          <p>
            • Peak signup month: <span className="font-semibold">{growthData.bestMonth}</span> with {growthData.bestMonthCount} new users
          </p>
          <p>
            • Average velocity: <span className="font-semibold">{growthData.velocity} users/day</span> over the period
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
