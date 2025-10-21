import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, 
  Heart, 
  Link, 
  Navigation, 
  Clock,
  User,
  Activity,
  RefreshCw,
  Radio,
  ChevronRight
} from 'lucide-react';
import { useRecentUserActivity } from '@/hooks/use-recent-user-activity';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import UserDetailsSidePanel from './UserDetailsSidePanel';

interface GroupedUserActivity {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
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


export function UserActivityFeed() {
  const { data: activities, isLoading, error, refetch, isRefetching } = useRecentUserActivity();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setSidePanelOpen(true);
  };

  // Group activities by user
  const groupedActivities: GroupedUserActivity[] = React.useMemo(() => {
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

  // Set up real-time subscriptions for activity updates
  useEffect(() => {
    
    
    // Subscribe to listing analytics changes
    const listingAnalyticsChannel = supabase
      .channel('listing-analytics-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'listing_analytics'
      }, (payload) => {
        
        refetch();
      })
      .subscribe();

    // Subscribe to page views changes
    const pageViewsChannel = supabase
      .channel('page-views-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'page_views'
      }, (payload) => {
        
        refetch();
      })
      .subscribe();

    // Subscribe to user events changes
    const userEventsChannel = supabase
      .channel('user-events-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_events'
      }, (payload) => {
        
        refetch();
      })
      .subscribe();

    // Subscribe to connection requests changes
    const connectionRequestsChannel = supabase
      .channel('connection-requests-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connection_requests'
      }, (payload) => {
        
        refetch();
      })
      .subscribe();

    // Auto-refresh every 30 seconds as fallback
    const autoRefreshInterval = setInterval(() => {
      
      refetch();
    }, 30000);

    return () => {
      
      listingAnalyticsChannel.unsubscribe();
      pageViewsChannel.unsubscribe();
      userEventsChannel.unsubscribe();
      connectionRequestsChannel.unsubscribe();
      clearInterval(autoRefreshInterval);
    };
  }, [refetch]);

  const getActivityIcon = (activityType: string, actionType?: string) => {
    switch (activityType) {
      case 'listing_action':
        switch (actionType) {
          case 'view': return <Eye className="h-4 w-4" />;
          case 'save': return <Heart className="h-4 w-4" />;
          case 'request_connection': return <Link className="h-4 w-4" />;
          default: return <Activity className="h-4 w-4" />;
        }
      case 'page_view':
        return <Navigation className="h-4 w-4" />;
      case 'user_event':
        return <Activity className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getActivityColor = (activityType: string, actionType?: string) => {
    switch (activityType) {
      case 'listing_action':
        switch (actionType) {
          case 'view': return 'bg-blue-100 text-blue-800 border-blue-200';
          case 'save': return 'bg-pink-100 text-pink-800 border-pink-200';
          case 'request_connection': return 'bg-green-100 text-green-800 border-green-200';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      case 'page_view':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'user_event':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityDescription = (activity: any) => {
    const userName = `${activity.first_name} ${activity.last_name}`.trim() || activity.email;
    
    switch (activity.activity_type) {
      case 'listing_action':
        switch (activity.action_type) {
          case 'view':
            return `${userName} viewed "${activity.listing_title}"`;
          case 'save':
            return `${userName} saved "${activity.listing_title}"`;
          case 'unsave':
            return `${userName} unsaved "${activity.listing_title}"`;
          case 'request_connection':
            return `${userName} requested connection for "${activity.listing_title}"`;
          default:
            return `${userName} interacted with "${activity.listing_title}"`;
        }
      case 'page_view':
        return `${userName} visited ${activity.page_path}`;
      case 'user_event':
        return `${userName} performed ${activity.action_type?.replace('_', ' ')}`;
      default:
        return `${userName} performed an action`;
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent User Activity
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Failed to load user activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live User Activity
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              Real-time
            </Badge>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No recent activity found</p>
            <p className="text-sm text-muted-foreground mt-2">
              User actions will appear here in real-time
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {groupedActivities.slice(0, 20).map((userGroup, index) => {
                  const userName = `${userGroup.first_name || ''} ${userGroup.last_name || ''}`.trim() || userGroup.email;
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
                    <div key={userGroup.user_id}>
                      <div 
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleUserClick(userGroup.user_id)}
                      >
                        <Avatar className="h-10 w-10 border">
                          <AvatarFallback className="text-sm">
                            {userGroup.first_name?.charAt(0) || userGroup.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-none mb-1 truncate">
                                {userName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {userGroup.email}
                              </p>
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                {activitySummary.map((summary, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {summary}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(userGroup.lastActivityTime), 'MMM d, HH:mm')}
                                <span className="text-xs">•</span>
                                <span className="text-xs">
                                  {userGroup.totalActivities} total actions
                                </span>
                              </div>
                            </div>
                            
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                      
                      {index < groupedActivities.length - 1 && <Separator className="my-2" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <UserDetailsSidePanel
              userId={selectedUserId}
              open={sidePanelOpen}
              onOpenChange={setSidePanelOpen}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}