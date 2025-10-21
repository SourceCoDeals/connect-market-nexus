import React, { useMemo, useState } from 'react';
import { Users, UserCheck, UserX, Clock, BarChart3, Filter, Download, Mail, CheckCircle2 } from 'lucide-react';
import { HeroStatsSection } from '../analytics/HeroStatsSection';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UserOverviewTabProps {
  users: User[];
  totalUsers: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export function UserOverviewTab({ 
  users, 
  totalUsers, 
  pendingCount, 
  approvedCount,
  rejectedCount 
}: UserOverviewTabProps) {

  // Calculate trends (real data based on last week)
  const analytics = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const newUsersThisWeek = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= weekAgo;
    }).length;
    
    const newUsersLastWeek = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= twoWeeksAgo && createdAt < weekAgo;
    }).length;
    
    const approvedThisWeek = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= weekAgo && u.approval_status === 'approved';
    }).length;
    
    const approvedLastWeek = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= twoWeeksAgo && createdAt < weekAgo && u.approval_status === 'approved';
    }).length;
    
    // Calculate profile completion
    const profileCompletions = users.map(user => {
      const fields = [
        'first_name', 'last_name', 'email', 'company', 'phone_number',
        'website', 'linkedin_profile', 'buyer_type', 'ideal_target_description'
      ];
      const completed = fields.filter(field => user[field as keyof User]).length;
      return (completed / fields.length) * 100;
    });
    
    const avgCompletion = profileCompletions.reduce((a, b) => a + b, 0) / users.length || 0;
    
    // Calculate trends
    const userGrowthTrend = newUsersLastWeek > 0 
      ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
      : 0;
      
    const approvalTrend = approvedLastWeek > 0
      ? Math.round(((approvedThisWeek - approvedLastWeek) / approvedLastWeek) * 100)
      : 0;

    // Quick insights for action items
    const incompleteProfiles = users.filter(u => {
      const fields = ['first_name', 'last_name', 'email', 'company', 'phone_number', 'website', 'linkedin_profile', 'buyer_type'];
      const completed = fields.filter(field => u[field as keyof User]).length;
      return (completed / fields.length) * 100 < 80;
    }).length;

    const recentSignups = users.filter(u => {
      const createdAt = new Date(u.created_at);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      return createdAt >= threeDaysAgo;
    }).length;
    
    return {
      newUsersThisWeek,
      userGrowthTrend,
      approvedThisWeek,
      approvalTrend,
      avgCompletion,
      incompleteProfiles,
      recentSignups
    };
  }, [users]);

  const stats = [
    {
      label: 'Total users',
      value: totalUsers,
      icon: <Users className="h-5 w-5" />,
      trend: analytics.userGrowthTrend !== 0 ? {
        value: Math.abs(analytics.userGrowthTrend),
        isPositive: analytics.userGrowthTrend > 0,
        label: 'vs last week',
      } : undefined,
      variant: 'default' as const,
    },
    {
      label: 'Pending approval',
      value: pendingCount,
      icon: <Clock className="h-5 w-5" />,
      variant: 'warning' as const,
    },
    {
      label: 'Approved users',
      value: approvedCount,
      icon: <UserCheck className="h-5 w-5" />,
      trend: analytics.approvalTrend !== 0 ? {
        value: Math.abs(analytics.approvalTrend),
        isPositive: analytics.approvalTrend > 0,
        label: 'this week',
      } : undefined,
      variant: 'success' as const,
    },
    {
      label: 'Profile completion',
      value: `${Math.round(analytics.avgCompletion)}%`,
      icon: <BarChart3 className="h-5 w-5" />,
      variant: analytics.avgCompletion >= 75 ? 'success' as const : 'warning' as const,
    },
  ];

  const filterPresets = [
    {
      id: 'needs-attention',
      label: 'Needs Attention',
      description: 'Pending approvals and incomplete profiles',
      count: pendingCount + analytics.incompleteProfiles,
      variant: 'secondary' as const,
    },
    {
      id: 'recent-signups',
      label: 'Recent Signups',
      description: 'New users in the last 3 days',
      count: analytics.recentSignups,
      variant: 'secondary' as const,
    },
    {
      id: 'incomplete-profiles',
      label: 'Incomplete Profiles',
      description: 'Less than 80% complete',
      count: analytics.incompleteProfiles,
      variant: 'outline' as const,
    },
  ];

  const actionItems = [
    {
      label: 'Pending Approvals',
      count: pendingCount,
      action: 'Review Now',
      variant: 'secondary' as const,
    },
    {
      label: 'Incomplete Profiles',
      count: analytics.incompleteProfiles,
      action: 'Send Reminder',
      variant: 'outline' as const,
    },
  ].filter(item => item.count > 0);

  return (
    <div className="space-y-8">
      <HeroStatsSection stats={stats} />
    </div>
  );
}
