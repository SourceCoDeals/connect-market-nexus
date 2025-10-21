import { Users, Store, MessageSquare, Activity, TrendingUp, TrendingDown, ArrowUpRight, UserPlus, Link as LinkIcon, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdmin } from "@/hooks/use-admin";
import { useRecentUserActivity } from "@/hooks/use-recent-user-activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export function StripeOverviewTab() {
  const { useStats } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentUserActivity();

  const businessMetrics = [
    {
      title: "Total users",
      value: stats?.totalUsers || 0,
      change: 12,
      isPositive: true,
      icon: Users,
      description: "Active marketplace users"
    },
    {
      title: "Active listings",
      value: stats?.totalListings || 0,
      change: 8,
      isPositive: true,
      icon: Store,
      description: "Live business listings"
    },
    {
      title: "Connections made",
      value: stats?.approvedConnections || 0,
      change: 15,
      isPositive: true,
      icon: Activity,
      description: "Successful connections"
    },
    {
      title: "Pending actions",
      value: (stats?.pendingUsers || 0) + (stats?.pendingConnections || 0),
      change: 5,
      isPositive: false,
      icon: MessageSquare,
      description: "Requires admin attention"
    }
  ];

  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Filter activities based on selected tab
  const filteredActivities = activities.filter(activity => {
    if (activityFilter === "all") return true;
    if (activityFilter === "users") return activity.activity_type === 'user_event' || activity.action_type === 'signup';
    if (activityFilter === "listings") return activity.activity_type === 'listing_action';
    if (activityFilter === "connections") return activity.action_type?.includes('connection') || activity.action_type?.includes('request');
    if (activityFilter === "views") return activity.activity_type === 'page_view';
    return true;
  });

  if (isLoadingStats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse border border-border/50 rounded-lg p-6">
              <div className="h-3 bg-muted/50 rounded w-1/2 mb-4"></div>
              <div className="h-10 bg-muted/50 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted/50 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics - Stripe style */}
      <div className="grid gap-4 md:grid-cols-4">
        {businessMetrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.isPositive ? TrendingUp : TrendingDown;
          
          return (
            <div key={metric.title} className="group relative">
              <div className="border border-border/50 rounded-lg p-6 bg-card hover:border-border transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
                    {metric.title}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground/40" />
                </div>

                {/* Value */}
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {metric.value.toLocaleString()}
                  </span>
                  {metric.change > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className={metric.isPositive ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                        {metric.isPositive ? '+' : '-'}{metric.change}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground/70">
                  {metric.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Activity Feed with Tabs - Unlimited scroll */}
      <div className="border border-border/50 rounded-lg bg-card overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Activity feed</h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Real-time updates from your marketplace</p>
            </div>
          </div>

          {/* Activity Filter Tabs */}
          <Tabs value={activityFilter} onValueChange={setActivityFilter} className="w-full">
            <TabsList className="inline-flex h-9 items-center justify-start rounded-md bg-muted/30 p-1 gap-1">
              <TabsTrigger 
                value="all"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Activity className="h-3 w-3 mr-1.5" />
                All activity
              </TabsTrigger>
              <TabsTrigger 
                value="users"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <UserPlus className="h-3 w-3 mr-1.5" />
                Users
              </TabsTrigger>
              <TabsTrigger 
                value="listings"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Store className="h-3 w-3 mr-1.5" />
                Listings
              </TabsTrigger>
              <TabsTrigger 
                value="connections"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <LinkIcon className="h-3 w-3 mr-1.5" />
                Connections
              </TabsTrigger>
              <TabsTrigger 
                value="views"
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Page views
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="divide-y divide-border/50">
          {isLoadingActivities ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-2 w-2 bg-muted/50 rounded-full"></div>
                  <div className="h-3 bg-muted/50 rounded flex-1"></div>
                  <div className="h-3 bg-muted/50 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredActivities.map((activity) => {
                const getActivityDescription = () => {
                  if (activity.activity_type === 'listing_action') {
                    return (
                      <>
                        <span className="font-medium">{activity.first_name} {activity.last_name}</span>
                        {' '}{activity.action_type}d listing{' '}
                        <span className="text-muted-foreground">{activity.listing_title}</span>
                      </>
                    );
                  } else if (activity.activity_type === 'page_view') {
                    return (
                      <>
                        <span className="font-medium">{activity.first_name} {activity.last_name}</span>
                        {' '}viewed{' '}
                        <span className="text-muted-foreground">{activity.page_path}</span>
                      </>
                    );
                  } else if (activity.activity_type === 'user_event') {
                    return (
                      <>
                        <span className="font-medium">{activity.first_name} {activity.last_name}</span>
                        {' '}performed{' '}
                        <span className="text-muted-foreground">{activity.action_type}</span>
                      </>
                    );
                  }
                  return 'Unknown activity';
                };

                return (
                  <div key={activity.id} className="flex items-start gap-3 px-6 py-4 hover:bg-muted/10 transition-colors text-sm">
                    <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">
                        {getActivityDescription()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground/70">
                {activityFilter === "all" ? "No recent activity" : `No ${activityFilter} activity`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
