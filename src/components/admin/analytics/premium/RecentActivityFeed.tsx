import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ActivityItem {
  id: string;
  userName: string;
  userType: string;
  action: string;
  timestamp: string;
  targetTitle?: string;
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

const ACTION_LABELS: Record<string, string> = {
  'connection_request': 'requested connection',
  'listing_view': 'viewed listing',
  'listing_save': 'saved listing',
  'signup': 'joined the platform',
  'profile_approved': 'was approved',
};

const TYPE_COLORS: Record<string, string> = {
  'Private Equity': 'bg-coral-400',
  'Individual': 'bg-peach-400',
  'Search Fund': 'bg-navy-600',
  'Independent Sponsor': 'bg-emerald-500',
  'Family Office': 'bg-violet-500',
  'Corporate': 'bg-amber-500',
  'default': 'bg-muted-foreground',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || TYPE_COLORS['default'];
}

export function RecentActivityFeed({ activities, className }: RecentActivityFeedProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6 h-full",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Recent Activity
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Latest buyer engagement
        </p>
      </div>

      {/* Activity List */}
      <div className="space-y-1">
        {activities.slice(0, 6).map((activity, index) => (
          <div 
            key={activity.id}
            className={cn(
              "flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg",
              "hover:bg-muted/30 transition-colors cursor-pointer group"
            )}
          >
            {/* Avatar with type indicator */}
            <div className="relative flex-shrink-0">
              <Avatar className="h-9 w-9 border border-border/50">
                <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                  {getInitials(activity.userName)}
                </AvatarFallback>
              </Avatar>
              <div 
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                  getTypeColor(activity.userType)
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-medium text-sm text-foreground truncate">
                  {activity.userName}
                </span>
                <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {ACTION_LABELS[activity.action] || activity.action}
                {activity.targetTitle && (
                  <span className="text-foreground/70"> • {activity.targetTitle}</span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {activity.userType}
              </p>
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
