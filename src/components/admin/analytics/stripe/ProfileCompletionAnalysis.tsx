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
    <div className="space-y-section">
      {/* Completion Distribution Chart */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Profile Completion Distribution</CardTitle>
          <CardDescription>User distribution across completion ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.chartData} barGap={8}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))" 
                  strokeOpacity={0.2} 
                  vertical={false}
                />
                <XAxis 
                  dataKey="range" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                  stroke="hsl(var(--border))"
                  axisLine={{ strokeOpacity: 0.3 }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                  stroke="hsl(var(--border))"
                  axisLine={{ strokeOpacity: 0.3 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                  formatter={(value: number) => [`${value} users`, 'Count']}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                />
                <Bar dataKey="users" radius={[8, 8, 0, 0]} maxBarSize={80}>
                  {analytics.chartData.map((entry, index) => (
                    <Bar key={`bar-${index}`} dataKey="users" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-section md:grid-cols-2">
        {/* Field Completion Heatmap */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Field Completion Rates</CardTitle>
            <CardDescription>Completion rate by profile field</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.fieldStats.map(field => {
                const isLow = field.rate < 50;
                const isMedium = field.rate >= 50 && field.rate < 75;
                const isHigh = field.rate >= 75;
                
                return (
                  <div 
                    key={field.field} 
                    className="p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className={
                        isLow ? 'text-destructive font-semibold' : 
                        isMedium ? 'text-warning font-medium' : 
                        'text-foreground font-medium'
                      }>
                        {field.field}
                      </span>
                      <span className="font-bold tabular-nums">{field.rate.toFixed(0)}%</span>
                    </div>
                    <Progress value={field.rate} className="h-2.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quality Score & Recommendations */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quality Overview</CardTitle>
            <CardDescription>Overall profile quality metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-section">
            {/* Quality Gauge - Stripe-inspired radial */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center w-40 h-40 mb-3">
                {/* Background ring */}
                <div className="absolute inset-0 rounded-full border-[12px] border-muted"></div>
                {/* Progress ring */}
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r="74"
                    fill="none"
                    stroke={
                      analytics.avgCompletion >= 75 ? 'hsl(var(--success))' : 
                      analytics.avgCompletion >= 50 ? 'hsl(var(--warning))' : 
                      'hsl(var(--destructive))'
                    }
                    strokeWidth="12"
                    strokeDasharray={`${(analytics.avgCompletion / 100) * 465} 465`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 shadow-glow"
                  />
                </svg>
                {/* Center content */}
                <div className="text-center z-10">
                  <p className="text-hero-md font-bold tabular-nums tracking-tight">{analytics.avgCompletion.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Avg Quality</p>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                analytics.avgCompletion >= 75 ? 'bg-success/10 text-success' : 
                analytics.avgCompletion >= 50 ? 'bg-warning/10 text-warning' : 
                'bg-destructive/10 text-destructive'
              }`}>
                {analytics.avgCompletion >= 75 ? 'Excellent' : 
                 analytics.avgCompletion >= 50 ? 'Good' : 'Needs Improvement'}
              </div>
            </div>

            {/* Key Stats */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between p-3 rounded-lg bg-success/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Complete profiles</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {analytics.distribution['75-100%']}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">Incomplete profiles</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {analytics.incompleteUsers}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total users</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {users.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="bg-gradient-subtle border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          {analytics.fieldStats[0] && analytics.fieldStats[0].rate < 70 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
              <p className="text-warning-foreground">
                Focus area: <span className="font-semibold">{analytics.fieldStats[0].field}</span> (only {analytics.fieldStats[0].rate.toFixed(0)}% completion)
              </p>
            </div>
          )}
          {analytics.incompleteUsers > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
              <p className="text-foreground/90">
                Send reminder emails to <span className="font-semibold">{analytics.incompleteUsers} users</span> with &lt;50% completion
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 mt-1.5 shrink-0" />
            <p className="text-foreground/90">
              Average profile quality: <span className="font-semibold">{analytics.avgCompletion.toFixed(0)}%</span> - {analytics.avgCompletion >= 75 ? 'Excellent work!' : 'Room for improvement'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
