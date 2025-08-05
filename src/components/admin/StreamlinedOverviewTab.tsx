import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Activity, 
  Store, 
  Link2,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  UserPlus,
  MessageSquare
} from 'lucide-react';
import { useAdmin } from '@/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface StreamlinedOverviewTabProps {
  stats: any;
  isLoading: boolean;
  onRefresh: () => void;
}

export function StreamlinedOverviewTab({ stats, isLoading, onRefresh }: StreamlinedOverviewTabProps) {
  const { useRecentActivities } = useAdmin();
  const { data: activities = [], isLoading: activitiesLoading } = useRecentActivities();
  const isMobile = useIsMobile();

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  const keyMetrics = [
    {
      title: 'Total Users',
      value: stats?.totalUsers?.toLocaleString() || '0',
      icon: Users,
      trend: '+12%',
      trendPositive: true,
      description: `${stats?.pendingUsers || 0} pending approval`
    },
    {
      title: 'Active Listings',
      value: stats?.totalListings?.toLocaleString() || '0',
      icon: Store,
      trend: '+5%',
      trendPositive: true,
      description: 'Available opportunities'
    },
    {
      title: 'Pending Connections',
      value: stats?.pendingConnections?.toLocaleString() || '0',
      icon: Link2,
      urgent: (stats?.pendingConnections || 0) > 5,
      description: 'Require review'
    },
    {
      title: 'Approved Connections',
      value: stats?.approvedConnections?.toLocaleString() || '0',
      icon: CheckCircle,
      trend: '+18%',
      trendPositive: true,
      description: 'Successfully matched'
    }
  ];

  const quickActions = [
    {
      title: 'Review Pending Users',
      count: stats?.pendingUsers || 0,
      icon: UserPlus,
      variant: 'default' as const,
      urgent: (stats?.pendingUsers || 0) > 3
    },
    {
      title: 'Approve Connections',
      count: stats?.pendingConnections || 0,
      icon: Link2,
      variant: 'default' as const,
      urgent: (stats?.pendingConnections || 0) > 5
    },
    {
      title: 'Review Feedback',
      count: 3, // This would come from feedback API
      icon: MessageSquare,
      variant: 'outline' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Key Metrics</h2>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {keyMetrics.map((metric, index) => (
            <Card key={index} className={metric.urgent ? 'border-destructive' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <metric.icon className={`h-4 w-4 ${metric.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
                {metric.trend && (
                  <div className="flex items-center mt-2">
                    <Badge 
                      variant={metric.trendPositive ? "default" : "destructive"}
                      className="text-xs"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {metric.trend}
                    </Badge>
                  </div>
                )}
                {metric.urgent && (
                  <div className="flex items-center mt-2">
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Urgent
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {quickActions.map((action, index) => (
            <Card key={index} className={action.urgent ? 'border-destructive bg-destructive/5' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <action.icon className={`h-5 w-5 ${action.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="font-medium">{action.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {action.count} item{action.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant={action.urgent ? "destructive" : action.variant} 
                    size="sm"
                    disabled={action.count === 0}
                  >
                    {action.urgent ? 'Urgent' : 'Review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Activity Feed
            </CardTitle>
            <CardDescription>
              Real-time marketplace activity and user actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <ActivitySkeleton />
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.slice(0, 8).map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Skeleton className="w-2 h-2 rounded-full mt-2" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
          <Skeleton className="w-2 h-2 rounded-full mt-2" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}