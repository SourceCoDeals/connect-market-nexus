import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Heart, 
  Link, 
  Navigation, 
  Clock,
  User,
  Activity,
  RefreshCw
} from 'lucide-react';
import { useRecentUserActivity } from '@/hooks/use-user-activity';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export function UserActivityFeed() {
  const { data: activities, isLoading, error, refetch } = useRecentUserActivity();

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
            Recent User Activity
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
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
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {activities.slice(0, 20).map((activity, index) => (
                <div key={activity.id}>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border">
                      <AvatarFallback className="text-xs">
                        {activity.first_name?.charAt(0) || activity.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium leading-none mb-1">
                            {getActivityDescription(activity)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(activity.created_at), 'MMM d, HH:mm:ss')}
                            <span className="text-xs">•</span>
                            <span className="font-mono text-xs">
                              {activity.email}
                            </span>
                          </div>
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className={`flex items-center gap-1 ${getActivityColor(activity.activity_type, activity.action_type)}`}
                        >
                          {getActivityIcon(activity.activity_type, activity.action_type)}
                          {activity.action_type || activity.activity_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {index < activities.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}