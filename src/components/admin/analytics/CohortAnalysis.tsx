import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { Calendar, TrendingUp, Users } from 'lucide-react';

interface CohortAnalysisProps {
  users: User[];
}

export function CohortAnalysis({ users }: CohortAnalysisProps) {
  const cohortData = useMemo(() => {
    const cohorts: Record<string, {
      total: number;
      approved: number;
      avgCompletion: number;
      approvalRate: number;
    }> = {};

    users.forEach(user => {
      const date = new Date(user.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!cohorts[monthKey]) {
        cohorts[monthKey] = {
          total: 0,
          approved: 0,
          avgCompletion: 0,
          approvalRate: 0,
        };
      }

      cohorts[monthKey].total++;
      if (user.approval_status === 'approved') {
        cohorts[monthKey].approved++;
      }

      // Calculate profile completion
      const fields = [
        'first_name', 'last_name', 'email', 'company', 'phone_number',
        'website', 'linkedin_profile', 'buyer_type', 'ideal_target_description'
      ];
      const completed = fields.filter(field => user[field as keyof User]).length;
      const completion = (completed / fields.length) * 100;
      
      cohorts[monthKey].avgCompletion += completion;
    });

    // Calculate averages and rates
    Object.keys(cohorts).forEach(month => {
      cohorts[month].avgCompletion = cohorts[month].avgCompletion / cohorts[month].total;
      cohorts[month].approvalRate = (cohorts[month].approved / cohorts[month].total) * 100;
    });

    return Object.entries(cohorts)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6);
  }, [users]);

  const formatMonth = (monthKey: string) => {
    const date = new Date(monthKey + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getQualityBadge = (avgCompletion: number, approvalRate: number) => {
    const score = (avgCompletion + approvalRate) / 2;
    if (score >= 80) return { label: 'High Quality', variant: 'default' as const, color: 'text-success' };
    if (score >= 60) return { label: 'Good Quality', variant: 'secondary' as const, color: 'text-warning' };
    return { label: 'Needs Improvement', variant: 'outline' as const, color: 'text-muted-foreground' };
  };

  return (
    <div className="space-y-section">
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            User Cohort Performance
          </CardTitle>
          <CardDescription>
            Quality metrics by signup month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cohortData.map(([month, data]) => {
              const quality = getQualityBadge(data.avgCompletion, data.approvalRate);
              
              return (
                <div 
                  key={month} 
                  className="group p-card border border-border/50 rounded-lg hover:shadow-lg transition-all duration-300 bg-gradient-subtle"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-base">{formatMonth(month)}</p>
                      <p className="text-sm text-muted-foreground font-medium">{data.total} new users</p>
                    </div>
                    <Badge variant={quality.variant} className="font-bold">{quality.label}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                    <div className="p-2.5 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Approved</p>
                      <p className="text-xl font-bold tabular-nums tracking-tight">
                        {data.approved}
                      </p>
                      <p className="text-xs text-muted-foreground font-semibold tabular-nums mt-0.5">
                        {Math.round(data.approvalRate)}%
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Avg Completion</p>
                      <p className={`text-xl font-bold tabular-nums tracking-tight ${
                        data.avgCompletion >= 75 ? 'text-success' : 
                        data.avgCompletion >= 50 ? 'text-warning' : 
                        'text-muted-foreground'
                      }`}>
                        {Math.round(data.avgCompletion)}%
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Total Users</p>
                      <p className="text-xl font-bold tabular-nums tracking-tight">
                        {data.total}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quality Trends
          </CardTitle>
          <CardDescription>
            Month-over-month improvement analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cohortData.slice(0, 3).map(([month, data], index) => {
              if (index === cohortData.length - 1) return null;
              
              const prevData = cohortData[index + 1]?.[1];
              if (!prevData) return null;

              const approvalChange = data.approvalRate - prevData.approvalRate;
              const completionChange = data.avgCompletion - prevData.avgCompletion;

              return (
                <div 
                  key={month} 
                  className="p-card bg-gradient-subtle rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <p className="font-semibold mb-3 text-sm">{formatMonth(month)} vs {formatMonth(cohortData[index + 1][0])}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Approval Rate</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold tabular-nums ${
                          approvalChange > 0 ? 'text-success' : 
                          approvalChange < 0 ? 'text-destructive' : 
                          'text-muted-foreground'
                        }`}>
                          {approvalChange > 0 ? '+' : ''}{Math.round(approvalChange)}%
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-card/50">
                      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Completion Rate</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold tabular-nums ${
                          completionChange > 0 ? 'text-success' : 
                          completionChange < 0 ? 'text-destructive' : 
                          'text-muted-foreground'
                        }`}>
                          {completionChange > 0 ? '+' : ''}{Math.round(completionChange)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
