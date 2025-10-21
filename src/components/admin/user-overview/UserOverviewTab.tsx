import React from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { HeroStatsSection } from '../analytics/HeroStatsSection';
import { User } from '@/types';

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
  // Calculate trends (mock data - in production, compare with previous period)
  const newUsersThisWeek = users.filter(u => {
    const createdAt = new Date(u.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdAt >= weekAgo;
  }).length;

  const stats = [
    {
      label: 'Total Users',
      value: totalUsers,
      icon: <Users className="h-5 w-5" />,
      trend: {
        value: 12,
        isPositive: true,
        label: 'vs last week',
      },
      variant: 'default' as const,
    },
    {
      label: 'Pending Approval',
      value: pendingCount,
      icon: <Clock className="h-5 w-5" />,
      variant: 'warning' as const,
    },
    {
      label: 'Approved Users',
      value: approvedCount,
      icon: <UserCheck className="h-5 w-5" />,
      trend: {
        value: 8,
        isPositive: true,
        label: 'this week',
      },
      variant: 'success' as const,
    },
    {
      label: 'Rejected',
      value: rejectedCount,
      icon: <UserX className="h-5 w-5" />,
      variant: 'default' as const,
    },
  ];

  return (
    <div className="space-y-8">
      <HeroStatsSection stats={stats} />
    </div>
  );
}
