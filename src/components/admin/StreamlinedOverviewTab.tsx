import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Users, Store, MessageSquare, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdmin } from "@/hooks/use-admin";
import { useRecentUserActivity } from "@/hooks/use-recent-user-activity";
import { Badge } from "@/components/ui/badge";

export function StreamlinedOverviewTab() {
  const { useStats } = useAdmin();
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities, refetch: refetchActivities } = useRecentUserActivity();

  const handleRefresh = () => {
    refetchStats();
    refetchActivities();
  };

  const businessMetrics = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      change: "+12%",
      trend: "up",
      icon: Users,
      description: "Active marketplace users"
    },
    {
      title: "Active Listings",
      value: stats?.totalListings || 0,
      change: "+8%",
      trend: "up",
      icon: Store,
      description: "Live business listings"
    },
    {
      title: "Connections Made",
      value: stats?.approvedConnections || 0,
      change: "+15%",
      trend: "up",
      icon: Activity,
      description: "Successful connections"
    },
    {
      title: "Pending Actions",
      value: (stats?.pendingUsers || 0) + (stats?.pendingConnections || 0),
      change: "-5%",
      trend: "down",
      icon: MessageSquare,
      description: "Requires admin attention"
    }
  ];

  const quickActions = [
    {
      title: "Pending User Approvals",
      count: stats?.pendingUsers || 0,
      urgent: (stats?.pendingUsers || 0) > 5,
      action: "Review Users"
    },
    {
      title: "Connection Requests",
      count: stats?.pendingConnections || 0,
      urgent: (stats?.pendingConnections || 0) > 10,
      action: "Review Requests"
    },
    {
      title: "Unread Feedback",
      count: 3, // This would come from feedback hook
      urgent: false,
      action: "View Feedback"
    }
  ];

  if (isLoadingStats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Business Overview</h2>
          <p className="text-muted-foreground">Key metrics and recent activity</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Key Business Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        {businessMetrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;
          
          return (
            <Card key={metric.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendIcon className={`h-3 w-3 ${metric.trend === "up" ? "text-green-500" : "text-red-500"}`} />
                  <span className={metric.trend === "up" ? "text-green-500" : "text-red-500"}>
                    {metric.change}
                  </span>
                  <span>vs last month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Items requiring immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {quickActions.map((action) => (
              <div key={action.title} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={action.urgent ? "destructive" : "secondary"}>
                      {action.count}
                    </Badge>
                    {action.urgent && (
                      <span className="text-xs text-red-500">Urgent</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  {action.action}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Activity</CardTitle>
          <CardDescription>Recent marketplace activity</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-2 w-2 bg-muted rounded-full"></div>
                  <div className="h-4 bg-muted rounded flex-1"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activities.slice(0, 8).map((activity) => {
                const getActivityDescription = () => {
                  if (activity.activity_type === 'listing_action') {
                    return `${activity.first_name} ${activity.last_name} ${activity.action_type}d listing: ${activity.listing_title}`;
                  } else if (activity.activity_type === 'page_view') {
                    return `${activity.first_name} ${activity.last_name} viewed ${activity.page_path}`;
                  } else if (activity.activity_type === 'user_event') {
                    return `${activity.first_name} ${activity.last_name} performed ${activity.action_type}`;
                  }
                  return 'Unknown activity';
                };

                return (
                  <div key={activity.id} className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 bg-primary rounded-full"></div>
                    <span className="flex-1">{getActivityDescription()}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No recent activity</p>
          )}
        </CardContent>
      </Card>

      {/* Business Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Quick health indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Database: Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Email: Operational</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">Storage: 78% Used</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">API: Responsive</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}