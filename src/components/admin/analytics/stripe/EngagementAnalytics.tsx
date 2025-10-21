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
    <div className="space-y-6">
      {/* Time-Based Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Avg Time to Onboard</p>
            </div>
            <p className="text-3xl font-bold tabular-nums mb-1">
              {metrics.avgTimeToComplete.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">days to complete profile</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Avg Time to Approval</p>
            </div>
            <p className="text-3xl font-bold tabular-nums mb-1">
              {metrics.avgTimeToApproval.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">days from signup</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Active Users</p>
            </div>
            <p className="text-3xl font-bold tabular-nums mb-1">
              {metrics.activeUsers}
            </p>
            <p className="text-xs text-muted-foreground">active in last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Activity Segmentation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Activity Segmentation</CardTitle>
            <CardDescription>User engagement breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <span className="text-sm">Active (last 7 days)</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {metrics.activeUsers} ({metrics.activeRate.toFixed(0)}%)
                </span>
              </div>
              <Progress value={metrics.activeRate} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted"></div>
                  <span className="text-sm">Inactive (30+ days)</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {metrics.inactiveUsers} ({metrics.inactiveRate.toFixed(0)}%)
                </span>
              </div>
              <Progress value={metrics.inactiveRate} className="h-2" />
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">At-Risk Users</span>
                </div>
                <Badge variant="destructive">{metrics.atRiskUsers.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                60+ days inactive, previously engaged
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Lifecycle Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">User Lifecycle Funnel</CardTitle>
            <CardDescription>Progression through key stages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.funnelData.map((stage, index) => {
              const dropoffRate = index > 0 
                ? metrics.funnelData[index - 1].percentage - stage.percentage 
                : 0;
              
              return (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{stage.count}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {stage.percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-8 bg-muted rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                    {dropoffRate > 15 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
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
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              At-Risk Users Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metrics.atRiskUsers.slice(0, 10).map(user => (
                <div key={user.id} className="flex items-center justify-between p-2 bg-card rounded border border-border/50">
                  <div>
                    <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline">
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
