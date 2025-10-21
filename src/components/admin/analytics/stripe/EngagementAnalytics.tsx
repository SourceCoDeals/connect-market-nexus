import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "@/types";
import { Clock, CheckCircle2, Users, AlertTriangle, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface EngagementAnalyticsProps {
  users: User[];
}

export function EngagementAnalytics({ users }: EngagementAnalyticsProps) {
  const metrics = useMemo(() => {
    const now = new Date();
    
    // Time to complete onboarding (for those who completed)
    const completedUsers = users.filter(u => u.onboarding_completed);
    const avgTimeToComplete = completedUsers.length > 0
      ? completedUsers.reduce((sum, user) => {
          const created = new Date(user.created_at);
          const completed = new Date(user.updated_at); // Approximation
          const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completedUsers.length
      : 0;

    // Time to first approval
    const approvedUsers = users.filter(u => u.approval_status === 'approved');
    const avgTimeToApproval = approvedUsers.length > 0
      ? approvedUsers.reduce((sum, user) => {
          const created = new Date(user.created_at);
          const approved = new Date(user.updated_at); // Approximation
          const days = (approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / approvedUsers.length
      : 0;

    // Activity segmentation
    const activeUsers = users.filter(u => {
      const lastActivity = new Date(u.updated_at);
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity <= 7;
    }).length;

    const inactiveUsers = users.filter(u => {
      const lastActivity = new Date(u.updated_at);
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity > 30;
    }).length;

    const atRiskUsers = users.filter(u => {
      const lastActivity = new Date(u.updated_at);
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity > 60 && u.approval_status === 'approved';
    });

    const activeRate = users.length > 0 ? (activeUsers / users.length) * 100 : 0;
    const inactiveRate = users.length > 0 ? (inactiveUsers / users.length) * 100 : 0;

    // User lifecycle funnel
    const signups = users.length;
    const profileComplete = users.filter(u => u.onboarding_completed).length;
    const approved = approvedUsers.length;
    
    const funnelData = [
      { stage: 'Signup', count: signups, percentage: 100 },
      { stage: 'Profile Complete', count: profileComplete, percentage: signups > 0 ? (profileComplete / signups) * 100 : 0 },
      { stage: 'Approved', count: approved, percentage: signups > 0 ? (approved / signups) * 100 : 0 },
    ];

    return {
      avgTimeToComplete,
      avgTimeToApproval,
      activeUsers,
      inactiveUsers,
      atRiskUsers,
      activeRate,
      inactiveRate,
      funnelData,
    };
  }, [users]);

  return (
    <div className="space-y-section">
      {/* Time-Based Metrics */}
      <div className="grid gap-element md:grid-cols-3">
        <Card className="group border-border/50 shadow-sm hover:shadow-lg transition-all duration-300">
          <CardContent className="p-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg Time to Onboard</p>
            </div>
            <p className="text-hero-lg font-bold tabular-nums mb-1 tracking-tight">
              {metrics.avgTimeToComplete.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground font-medium">days to complete profile</p>
          </CardContent>
        </Card>

        <Card className="group border-border/50 shadow-sm hover:shadow-lg transition-all duration-300">
          <CardContent className="p-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-success/10 group-hover:bg-success/15 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg Time to Approval</p>
            </div>
            <p className="text-hero-lg font-bold tabular-nums mb-1 tracking-tight text-success">
              {metrics.avgTimeToApproval.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground font-medium">days from signup</p>
          </CardContent>
        </Card>

        <Card className="group border-border/50 shadow-sm hover:shadow-lg transition-all duration-300">
          <CardContent className="p-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Users</p>
            </div>
            <p className="text-hero-lg font-bold tabular-nums mb-1 tracking-tight text-primary">
              {metrics.activeUsers}
            </p>
            <p className="text-xs text-muted-foreground font-medium">active in last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-section md:grid-cols-2">
        {/* Activity Segmentation */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Activity Segmentation</CardTitle>
            <CardDescription>User engagement breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-element">
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-success shadow-glow"></div>
                  <span className="text-sm font-semibold">Active (last 7 days)</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {metrics.activeUsers} ({metrics.activeRate.toFixed(0)}%)
                </span>
              </div>
              <Progress value={metrics.activeRate} className="h-2.5" />
            </div>

            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></div>
                  <span className="text-sm font-semibold">Inactive (30+ days)</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {metrics.inactiveUsers} ({metrics.inactiveRate.toFixed(0)}%)
                </span>
              </div>
              <Progress value={metrics.inactiveRate} className="h-2.5" />
            </div>

            <div className="pt-4 border-t mt-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold">At-Risk Users</span>
                </div>
                <Badge variant="destructive" className="font-bold">{metrics.atRiskUsers.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 ml-1">
                60+ days inactive, previously engaged
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Lifecycle Funnel */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">User Lifecycle Funnel</CardTitle>
            <CardDescription>Progression through key stages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-element">
            {metrics.funnelData.map((stage, index) => {
              const dropoffRate = index > 0 
                ? metrics.funnelData[index - 1].percentage - stage.percentage 
                : 0;
              
              return (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold tabular-nums">{stage.count}</span>
                      <Badge variant="secondary" className="tabular-nums font-bold">
                        {stage.percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-10 bg-muted/50 rounded-lg overflow-hidden border border-border/50 shadow-sm">
                      <div 
                        className="h-full bg-gradient-primary transition-all duration-500 shadow-glow relative overflow-hidden"
                        style={{ width: `${stage.percentage}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-shine animate-shimmer" />
                      </div>
                    </div>
                    {dropoffRate > 15 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-destructive font-semibold p-2 rounded bg-destructive/5">
                        <TrendingDown className="h-3 w-3" />
                        <span>High drop-off: {dropoffRate.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Users Details */}
      {metrics.atRiskUsers.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              At-Risk Users Requiring Attention
            </CardTitle>
            <CardDescription>Approved users inactive for 60+ days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {metrics.atRiskUsers.slice(0, 10).map(user => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div>
                    <p className="text-sm font-semibold">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="font-bold tabular-nums">
                    {Math.floor((new Date().getTime() - new Date(user.updated_at).getTime()) / (1000 * 60 * 60 * 24))} days
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
