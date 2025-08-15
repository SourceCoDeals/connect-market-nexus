import React from 'react';
import { useUserCompleteActivity, UserTimelineActivity } from '@/hooks/admin/use-user-complete-activity';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  CheckCircle, 
  MessageSquare, 
  Eye, 
  Heart, 
  FileText, 
  Shield, 
  Clock,
  ExternalLink,
  User
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface UserActivityTimelineProps {
  userId: string;
  className?: string;
}

const getActivityIcon = (type: UserTimelineActivity['type'], actionType?: string) => {
  switch (type) {
    case 'system_event':
      if (actionType === 'signup') return <UserPlus className="h-4 w-4" />;
      if (actionType === 'verification') return <CheckCircle className="h-4 w-4" />;
      if (actionType === 'approval') return <CheckCircle className="h-4 w-4" />;
      return <User className="h-4 w-4" />;
    case 'connection_request':
      if (actionType === 'follow_up') return <MessageSquare className="h-4 w-4" />;
      if (actionType === 'rejection') return <MessageSquare className="h-4 w-4" />;
      return <ExternalLink className="h-4 w-4" />;
    case 'saved_listing':
      return <Heart className="h-4 w-4" />;
    case 'listing_interaction':
      return <Eye className="h-4 w-4" />;
    case 'nda_action':
      return <Shield className="h-4 w-4" />;
    case 'fee_agreement_action':
      return <FileText className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActivityColor = (type: UserTimelineActivity['type'], actionType?: string) => {
  switch (type) {
    case 'system_event':
      if (actionType === 'signup') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (actionType === 'verification') return 'bg-green-100 text-green-700 border-green-200';
      if (actionType === 'approval') return 'bg-green-100 text-green-700 border-green-200';
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'connection_request':
      if (actionType === 'follow_up') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (actionType === 'rejection') return 'bg-red-100 text-red-700 border-red-200';
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'saved_listing':
      return 'bg-pink-100 text-pink-700 border-pink-200';
    case 'listing_interaction':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'nda_action':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'fee_agreement_action':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusBadge = (activity: UserTimelineActivity) => {
  if (activity.type === 'connection_request' && activity.metadata?.status) {
    const status = activity.metadata.status;
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      followed_up: 'bg-blue-100 text-blue-800'
    };
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || ''}>
        {status}
      </Badge>
    );
  }
  return null;
};

export const UserActivityTimeline: React.FC<UserActivityTimelineProps> = ({ 
  userId, 
  className = '' 
}) => {
  const { data: activities = [], isLoading, error } = useUserCompleteActivity(userId);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        Failed to load user activity timeline
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        No activity found for this user
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h4 className="font-medium text-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Activity Timeline
      </h4>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity, index) => (
          <Card key={activity.id} className="p-4 relative">
            {/* Timeline line */}
            {index < activities.length - 1 && (
              <div className="absolute left-6 top-12 w-px h-8 bg-border"></div>
            )}
            
            <div className="flex items-start gap-3">
              {/* Activity icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center ${getActivityColor(activity.type, activity.metadata?.action_type)}`}>
                {getActivityIcon(activity.type, activity.metadata?.action_type)}
              </div>
              
              {/* Activity content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h5 className="font-medium text-sm text-foreground">
                    {activity.title}
                  </h5>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(activity)}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {activity.description}
                </p>
                
                {/* Additional metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{format(new Date(activity.timestamp), 'MMM d, yyyy \'at\' h:mm a')}</span>
                  
                  {activity.metadata?.admin && (
                    <span>
                      by {activity.metadata.admin.name || `${activity.metadata.admin.first_name} ${activity.metadata.admin.last_name}`}
                    </span>
                  )}
                  
                  {activity.metadata?.duration && (
                    <span>
                      {Math.round(activity.metadata.duration / 60)}m spent
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};