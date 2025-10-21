import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";
import { User } from "@/types";
import { AlertCircle, CheckCircle2, Target } from "lucide-react";

interface ProfileCompletionAnalysisProps {
  users: User[];
}

const PROFILE_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin_profile', label: 'LinkedIn Profile' },
  { key: 'buyer_type', label: 'Buyer Type' },
  { key: 'ideal_target_description', label: 'Ideal Target' },
];

export function ProfileCompletionAnalysis({ users }: ProfileCompletionAnalysisProps) {
  const analytics = useMemo(() => {
    // Calculate completion distribution
    const distribution = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0,
    };

    const fieldCompletion: Record<string, number> = {};
    PROFILE_FIELDS.forEach(field => {
      fieldCompletion[field.key] = 0;
    });

    let totalCompletion = 0;

    users.forEach(user => {
      const completed = PROFILE_FIELDS.filter(field => user[field.key as keyof User]).length;
      const percentage = (completed / PROFILE_FIELDS.length) * 100;
      totalCompletion += percentage;

      if (percentage <= 25) distribution['0-25%']++;
      else if (percentage <= 50) distribution['25-50%']++;
      else if (percentage <= 75) distribution['50-75%']++;
      else distribution['75-100%']++;

      // Track field completion
      PROFILE_FIELDS.forEach(field => {
        if (user[field.key as keyof User]) {
          fieldCompletion[field.key]++;
        }
      });
    });

    const avgCompletion = users.length > 0 ? totalCompletion / users.length : 0;

    // Prepare chart data
    const chartData = [
      { range: '0-25%', users: distribution['0-25%'], fill: 'hsl(var(--destructive))' },
      { range: '25-50%', users: distribution['25-50%'], fill: 'hsl(var(--warning))' },
      { range: '50-75%', users: distribution['50-75%'], fill: 'hsl(var(--primary))' },
      { range: '75-100%', users: distribution['75-100%'], fill: 'hsl(var(--success))' },
    ];

    // Field completion rates
    const fieldStats = PROFILE_FIELDS.map(field => ({
      field: field.label,
      rate: users.length > 0 ? (fieldCompletion[field.key] / users.length) * 100 : 0,
    })).sort((a, b) => a.rate - b.rate);

    const incompleteUsers = distribution['0-25%'] + distribution['25-50%'];

    return {
      chartData,
      fieldStats,
      avgCompletion,
      incompleteUsers,
      distribution,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Completion Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Profile Completion Distribution</CardTitle>
          <CardDescription>User distribution across completion ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="range" 
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
                  formatter={(value: number) => [`${value} users`, 'Count']}
                />
                <Bar dataKey="users" radius={[4, 4, 0, 0]}>
                  {analytics.chartData.map((entry, index) => (
                    <Bar key={`bar-${index}`} dataKey="users" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Field Completion Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Field Completion Rates</CardTitle>
            <CardDescription>Completion rate by profile field</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.fieldStats.map(field => (
                <div key={field.field}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className={field.rate < 50 ? 'text-destructive' : 'text-foreground'}>
                      {field.field}
                    </span>
                    <span className="font-medium tabular-nums">{field.rate.toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={field.rate} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quality Score & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Quality Overview</CardTitle>
            <CardDescription>Overall profile quality metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quality Gauge */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-muted mb-2"
                   style={{
                     borderTopColor: analytics.avgCompletion >= 75 ? 'hsl(var(--success))' : 
                                    analytics.avgCompletion >= 50 ? 'hsl(var(--warning))' : 
                                    'hsl(var(--destructive))',
                   }}>
                <div className="text-center">
                  <p className="text-3xl font-bold tabular-nums">{analytics.avgCompletion.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Avg Quality</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {analytics.avgCompletion >= 75 ? 'Excellent' : 
                 analytics.avgCompletion >= 50 ? 'Good' : 'Needs Improvement'}
              </p>
            </div>

            {/* Key Stats */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">Complete profiles</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {analytics.distribution['75-100%']}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm">Incomplete profiles</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {analytics.incompleteUsers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total users</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {users.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="bg-muted/30 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {analytics.fieldStats[0] && analytics.fieldStats[0].rate < 70 && (
            <p className="text-warning">
              • Focus area: <span className="font-semibold">{analytics.fieldStats[0].field}</span> (only {analytics.fieldStats[0].rate.toFixed(0)}% completion)
            </p>
          )}
          {analytics.incompleteUsers > 0 && (
            <p>
              • Send reminder emails to <span className="font-semibold">{analytics.incompleteUsers} users</span> with &lt;50% completion
            </p>
          )}
          <p>
            • Average profile quality: <span className="font-semibold">{analytics.avgCompletion.toFixed(0)}%</span> - {analytics.avgCompletion >= 75 ? 'Excellent work!' : 'Room for improvement'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
