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

  // Helper function to parse referrer into a friendly source name
  const parseReferrerSource = (referrer: string | null | undefined, utmSource: string | null | undefined, marketingChannel: string | null | undefined): string => {
    if (!referrer && !utmSource && !marketingChannel) return 'Direct';
    
    // Check UTM source first (most reliable)
    if (utmSource) {
      if (utmSource.toLowerCase().includes('brevo') || utmSource.toLowerCase().includes('sendinblue')) {
        return 'Brevo/Email';
      }
      if (utmSource.toLowerCase().includes('email')) return 'Email';
      if (utmSource.toLowerCase().includes('google')) return 'Google';
      if (utmSource.toLowerCase().includes('facebook')) return 'Facebook';
      if (utmSource.toLowerCase().includes('linkedin')) return 'LinkedIn';
      return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
    }

    // Check marketing channel
    if (marketingChannel && marketingChannel !== 'Direct') {
      return marketingChannel;
    }

    // Parse referrer URL
    if (referrer) {
      try {
        const url = new URL(referrer);
        const hostname = url.hostname.replace('www.', '');
        
        if (hostname.includes('brevo') || hostname.includes('sendinblue')) return 'Brevo/Email';
        if (hostname.includes('google')) return 'Google';
        if (hostname.includes('facebook')) return 'Facebook';
        if (hostname.includes('linkedin')) return 'LinkedIn';
        if (hostname.includes('t.co') || hostname.includes('twitter')) return 'Twitter/X';
        
        return hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
      } catch {
        return 'External Link';
      }
    }

    return 'Direct';
  };

  // Group activities by user with session data
  const groupedByUser = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    const userMap = new Map<string, GroupedUserActivity & { 
      mostRecentSession: any;
      dateFirstSeen: string;
      sessionReferrer: string;
    }>();

    activities.forEach(activity => {
      const userId = activity.user_id;
      if (!userId) return;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user_id: userId,
          email: activity.email,
          first_name: activity.first_name,
          last_name: activity.last_name,
          user_name: activity.user_name || `${activity.first_name || ''} ${activity.last_name || ''}`.trim() || activity.email,
          activities: [],
          lastActivityTime: activity.created_at,
          totalActivities: 0,
          actionCounts: {
            views: 0,
            saves: 0,
            connections: 0,
            pageViews: 0,
          },
          mostRecentSession: null,
          dateFirstSeen: activity.created_at,
          sessionReferrer: 'Direct',
        });
      }

      const userGroup = userMap.get(userId)!;
      userGroup.activities.push(activity);
      userGroup.totalActivities++;

      // Update last activity time if this is more recent
      if (new Date(activity.created_at) > new Date(userGroup.lastActivityTime)) {
        userGroup.lastActivityTime = activity.created_at;
        userGroup.mostRecentSession = activity;
      }

      // Track earliest activity (date first seen)
      if (new Date(activity.created_at) < new Date(userGroup.dateFirstSeen)) {
        userGroup.dateFirstSeen = activity.created_at;
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
            <div className="space-y-4 p-6">
              {filteredActivities.map((userGroup) => {
                const activitySummary = `${userGroup.totalActivities} event${userGroup.totalActivities !== 1 ? 's' : ''} in ${formatDistanceToNow(new Date(userGroup.lastActivityTime))}`;
                const sessionReferrer = parseReferrerSource(
                  userGroup.mostRecentSession?.referrer,
                  userGroup.mostRecentSession?.utm_source,
                  userGroup.mostRecentSession?.marketing_channel
                );

                return (
                  <div 
                    key={userGroup.user_id}
                    className="border border-border/50 rounded-lg p-6 hover:border-border transition-all bg-card"
                  >
                    <div className="flex items-start justify-between gap-6">
                      {/* Left side - User info */}
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar className="h-12 w-12 border">
                          <AvatarFallback className="text-base">
                            {userGroup.first_name?.charAt(0) || userGroup.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-foreground mb-1">
                            {userGroup.user_name}
                          </h4>
                          
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDistanceToNow(new Date(userGroup.lastActivityTime), { addSuffix: true })}
                            </div>
                            <span>•</span>
                            <span>{activitySummary}</span>
                          </div>

                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-sm text-primary hover:text-primary/80"
                            onClick={() => handleUserClick(userGroup.user_id)}
                          >
                            See more about this user →
                          </Button>
                        </div>
                      </div>

                      {/* Right side - User details */}
                      <div className="space-y-3 text-sm min-w-[300px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">User ID</span>
                          <span className="font-mono text-xs">{userGroup.user_id.substring(0, 16)}...</span>
                        </div>
                        
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Date First Seen</span>
                          <span>{format(new Date(userGroup.dateFirstSeen), 'MMMM d, yyyy')}</span>
                        </div>
                        
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Current Session Source</span>
                          <span className="font-medium">{sessionReferrer}</span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Email</span>
                          <span className="truncate text-xs">{userGroup.email}</span>
                        </div>
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
