import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/types';
import { 
  Users, 
  TrendingUp, 
  DollarSign,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HeroStatsSection } from './HeroStatsSection';

interface AnalyticsTabProps {
  users: User[];
}

export function AnalyticsTab({ users }: AnalyticsTabProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const analytics = useMemo(() => {
    const buyerTypeDistribution = users.reduce((acc, user) => {
      const type = user.buyer_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const profileCompletionScores = users.map(user => {
      const fields = [
        'first_name', 'last_name', 'email', 'company', 'phone_number',
        'website', 'linkedin_profile', 'buyer_type', 'ideal_target_description'
      ];
      const completed = fields.filter(field => user[field as keyof User]).length;
      return (completed / fields.length) * 100;
    });

    const avgProfileCompletion = profileCompletionScores.reduce((a, b) => a + b, 0) / users.length || 0;

    const completionDistribution = {
      '0-25%': profileCompletionScores.filter(s => s < 25).length,
      '25-50%': profileCompletionScores.filter(s => s >= 25 && s < 50).length,
      '50-75%': profileCompletionScores.filter(s => s >= 50 && s < 75).length,
      '75-100%': profileCompletionScores.filter(s => s >= 75).length,
    };

    // Calculate user growth over time
    const userGrowth = users.reduce((acc, user) => {
      const date = new Date(user.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const growthData = Object.entries(userGrowth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        users: count,
      }));

    // Buyer type stats with more detail
    const buyerTypeStats = Object.entries(buyerTypeDistribution).map(([type, count]) => {
      const usersOfType = users.filter(u => u.buyer_type === type);
      const avgCompletion = usersOfType.reduce((sum, user) => {
        const fields = ['first_name', 'last_name', 'email', 'company', 'phone_number', 'website'];
        const completed = fields.filter(f => user[f as keyof User]).length;
        return sum + (completed / fields.length) * 100;
      }, 0) / usersOfType.length || 0;

      return {
        type,
        count,
        percentage: (count / users.length) * 100,
        avgCompletion,
        approved: usersOfType.filter(u => u.approval_status === 'approved').length,
      };
    }).sort((a, b) => b.count - a.count);

    return {
      totalUsers: users.length,
      buyerTypeDistribution: buyerTypeStats,
      avgProfileCompletion,
      completionDistribution,
      growthData,
      activeUsers: users.filter(u => u.approval_status === 'approved').length,
      newUsersThisMonth: users.filter(u => {
        const createdAt = new Date(u.created_at);
        const now = new Date();
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [users]);

  const stats = [
    {
      label: 'Total Users',
      value: analytics.totalUsers,
      icon: <Users className="h-5 w-5" />,
      trend: {
        value: 12,
        isPositive: true,
        label: 'vs last month',
      },
      variant: 'default' as const,
    },
    {
      label: 'Active Users',
      value: analytics.activeUsers,
      icon: <Activity className="h-5 w-5" />,
      trend: {
        value: 8,
        isPositive: true,
        label: 'vs last month',
      },
      variant: 'success' as const,
    },
    {
      label: 'New This Month',
      value: analytics.newUsersThisMonth,
      icon: <TrendingUp className="h-5 w-5" />,
      variant: 'info' as const,
    },
    {
      label: 'Avg Profile Completion',
      value: `${Math.round(analytics.avgProfileCompletion)}%`,
      icon: <BarChart3 className="h-5 w-5" />,
      variant: analytics.avgProfileCompletion >= 75 ? 'success' as const : 'warning' as const,
    },
  ];

  const completionChartData = Object.entries(analytics.completionDistribution).map(([range, count]) => ({
    range,
    users: count,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">User Analytics</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive insights into user behavior and demographics
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Hero Stats */}
      <HeroStatsSection stats={stats} />

      {/* Charts and Insights */}
      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="growth">User Growth</TabsTrigger>
          <TabsTrigger value="buyers">Buyer Intelligence</TabsTrigger>
          <TabsTrigger value="profiles">Profile Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Growth Trend</CardTitle>
              <CardDescription>
                New user signups over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.growthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buyers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buyer Type Intelligence</CardTitle>
              <CardDescription>
                Detailed breakdown of buyer types and their engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.buyerTypeDistribution.map((stat) => (
                  <div key={stat.type} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold capitalize">
                            {stat.type.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <Badge variant="secondary">{stat.count} users</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Market Share</p>
                            <p className="font-semibold">{Math.round(stat.percentage)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Approved</p>
                            <p className="font-semibold">{stat.approved}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">{Math.round(stat.avgCompletion)}%</p>
                        <p className="text-xs text-muted-foreground">Avg Completion</p>
                      </div>
                    </div>
                    <Progress value={stat.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Completion Analysis</CardTitle>
              <CardDescription>
                Distribution of profile completion rates across all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="range" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="users" 
                      fill="hsl(var(--primary))"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Profile Completion Insights</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {analytics.completionDistribution['75-100%']} users have highly complete profiles (&gt;75%)</li>
                  <li>• {analytics.completionDistribution['0-25%']} users need significant profile improvements (&lt;25%)</li>
                  <li>• Average completion rate: {Math.round(analytics.avgProfileCompletion)}%</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
