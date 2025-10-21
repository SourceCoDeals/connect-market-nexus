import { Users, Store, MessageSquare, Activity, TrendingUp, TrendingDown, UserPlus, Link as LinkIcon, Eye, ChevronRight, Heart, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useAdmin } from "@/hooks/use-admin";
import { useRecentUserActivity } from "@/hooks/use-recent-user-activity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { ActivityDetailsDropdown } from "./ActivityDetailsDropdown";
import UserDetailsSidePanel from "./UserDetailsSidePanel";

interface GroupedUserActivity {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  user_name: string;
  activities: any[];
  lastActivityTime: string;
  totalActivities: number;
  actionCounts: {
    views: number;
    saves: number;
    connections: number;
    pageViews: number;
  };
}

export function StripeOverviewTab() {
  const { useStats } = useAdmin();
  const { data: stats, isLoading: isLoadingStats } = useStats();
  const { data: activities = [], isLoading: isLoadingActivities } = useRecentUserActivity();
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const handleUserClick = (userId: string | null) => {
    if (userId) {
      setSelectedUserId(userId);
      setSidePanelOpen(true);
    }
  };

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

  // Group activities by user first
  const groupedByUser = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    const userMap = new Map<string, GroupedUserActivity>();

    activities.forEach(activity => {
      const userId = activity.user_id;
      if (!userId) return;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          email: activity.email,
          first_name: activity.first_name,
          last_name: activity.last_name,
          user_name: activity.user_name || 'Unknown User',
          activities: [],
          lastActivityTime: activity.created_at,
          totalActivities: 0,
          actionCounts: {
            views: 0,
            saves: 0,
            connections: 0,
            pageViews: 0,
          }
        });
      }

      const userGroup = userMap.get(userId)!;
      userGroup.activities.push(activity);
      userGroup.totalActivities++;

      // Update last activity time if this is more recent
      if (new Date(activity.created_at) > new Date(userGroup.lastActivityTime)) {
        userGroup.lastActivityTime = activity.created_at;
      }

      // Count action types
      if (activity.activity_type === 'listing_action') {
        if (activity.action_type === 'view') userGroup.actionCounts.views++;
        else if (activity.action_type === 'save') userGroup.actionCounts.saves++;
        else if (activity.action_type === 'request_connection') userGroup.actionCounts.connections++;
      } else if (activity.activity_type === 'page_view') {
        userGroup.actionCounts.pageViews++;
      }
    });

    // Convert to array and sort by last activity time
    return Array.from(userMap.values())
      .sort((a, b) => new Date(b.lastActivityTime).getTime() - new Date(a.lastActivityTime).getTime());
  }, [activities]);

  // Filter grouped activities based on selected tab
  const filteredActivities = groupedByUser.filter(userGroup => {
    if (activityFilter === "all") return true;
    if (activityFilter === "users") {
      return userGroup.activities.some(a => 
        a.activity_type === 'user_event' || 
        a.description.toLowerCase().includes('signup')
      );
    }
    if (activityFilter === "listings") {
      return userGroup.actionCounts.views > 0 || userGroup.actionCounts.saves > 0;
    }
    if (activityFilter === "connections") {
      return userGroup.actionCounts.connections > 0;
    }
    if (activityFilter === "views") {
      return userGroup.actionCounts.pageViews > 0;
    }
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
              {filteredActivities.map((userGroup) => {
                const activitySummary = [];
                
                if (userGroup.actionCounts.views > 0) {
                  activitySummary.push(`${userGroup.actionCounts.views} views`);
                }
                if (userGroup.actionCounts.saves > 0) {
                  activitySummary.push(`${userGroup.actionCounts.saves} saves`);
                }
                if (userGroup.actionCounts.connections > 0) {
                  activitySummary.push(`${userGroup.actionCounts.connections} connections`);
                }
                if (userGroup.actionCounts.pageViews > 0) {
                  activitySummary.push(`${userGroup.actionCounts.pageViews} page views`);
                }

                return (
                  <div 
                    key={userGroup.user_id}
                    className="flex items-start gap-3 px-6 py-4 hover:bg-muted/10 transition-colors border-b border-border/30 last:border-b-0 cursor-pointer"
                    onClick={() => handleUserClick(userGroup.user_id)}
                  >
                    <Avatar className="h-10 w-10 border mt-0.5">
                      <AvatarFallback className="text-sm">
                        {userGroup.first_name?.charAt(0) || userGroup.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {userGroup.user_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {userGroup.email}
                          </p>
                          
                          <div className="flex items-center flex-wrap gap-2 mt-2">
                            {activitySummary.map((summary, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {summary}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(userGroup.lastActivityTime), { addSuffix: true })}
                            <span>•</span>
                            <span>{userGroup.totalActivities} total actions</span>
                          </div>

                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 mt-2 text-xs text-primary hover:text-primary/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserClick(userGroup.user_id);
                            }}
                          >
                            See more about this user →
                          </Button>
                        </div>
                        
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </div>
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

      {/* User Details Side Panel */}
      <UserDetailsSidePanel
        userId={selectedUserId}
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
      />
    </div>
  );
}
