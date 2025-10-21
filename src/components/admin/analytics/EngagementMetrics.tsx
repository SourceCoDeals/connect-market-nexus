import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User } from '@/types';
import { Clock, UserCheck, Activity, Calendar } from 'lucide-react';

interface EngagementMetricsProps {
  users: User[];
}

export function EngagementMetrics({ users }: EngagementMetricsProps) {
  // Calculate engagement metrics
  const now = new Date();
  
  const avgTimeToComplete = users
    .filter(u => u.onboarding_completed && u.created_at)
    .map(u => {
      const created = new Date(u.created_at);
      const updated = new Date(u.updated_at);
      return (updated.getTime() - created.getTime()) / (1000 * 60); // minutes
    })
    .reduce((a, b) => a + b, 0) / users.filter(u => u.onboarding_completed).length || 0;

  const avgTimeToApproval = users
    .filter(u => u.approval_status === 'approved' && u.created_at)
    .map(u => {
      const created = new Date(u.created_at);
      const updated = new Date(u.updated_at);
      return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
    })
    .reduce((a, b) => a + b, 0) / users.filter(u => u.approval_status === 'approved').length || 0;

  const activeUsers = users.filter(u => {
    const updated = new Date(u.updated_at);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return updated >= thirtyDaysAgo && u.approval_status === 'approved';
  }).length;

  const inactiveUsers = users.filter(u => {
    const updated = new Date(u.updated_at);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return updated < thirtyDaysAgo && u.approval_status === 'approved';
  }).length;

  const activeRate = users.length > 0 ? (activeUsers / users.length) * 100 : 0;
  const approvalRate = users.length > 0 ? (users.filter(u => u.approval_status === 'approved').length / users.length) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time Metrics
          </CardTitle>
          <CardDescription>
            Average time for key milestones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Time to Complete Signup</span>
              <span className="text-lg font-semibold tabular-nums">
                {avgTimeToComplete < 60 
                  ? `${Math.round(avgTimeToComplete)}m` 
                  : `${Math.round(avgTimeToComplete / 60)}h`}
              </span>
            </div>
            <Progress value={Math.min((avgTimeToComplete / 30) * 100, 100)} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Time to First Approval</span>
              <span className="text-lg font-semibold tabular-nums">
                {avgTimeToApproval < 1 
                  ? `${Math.round(avgTimeToApproval * 24)}h` 
                  : `${Math.round(avgTimeToApproval)}d`}
              </span>
            </div>
            <Progress value={Math.min((avgTimeToApproval / 7) * 100, 100)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            User Activity
          </CardTitle>
          <CardDescription>
            Active vs inactive user breakdown
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Active Users</p>
              <p className="text-sm text-muted-foreground">Last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-success">{activeUsers}</p>
              <Badge variant="outline" className="text-xs border-success text-success">
                {Math.round(activeRate)}%
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Inactive Users</p>
              <p className="text-sm text-muted-foreground">No activity 30+ days</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">{inactiveUsers}</p>
              <Badge variant="outline" className="text-xs">
                {Math.round(100 - activeRate)}%
              </Badge>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Approval Rate</span>
              <span className="text-sm font-semibold tabular-nums">{Math.round(approvalRate)}%</span>
            </div>
            <Progress value={approvalRate} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
