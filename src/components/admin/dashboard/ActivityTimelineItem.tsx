import { ArrowRight, MessageSquare, CheckCircle2, User, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DealActivity {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  created_at: string;
  admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface ActivityTimelineItemProps {
  activity: DealActivity;
}

export function ActivityTimelineItem({ activity }: ActivityTimelineItemProps) {
  const getIcon = () => {
    switch (activity.activity_type) {
      case 'stage_change':
        return <ArrowRight className="h-3 w-3" />;
      case 'follow_up':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'task_created':
      case 'task_completed':
        return <MessageSquare className="h-3 w-3" />;
      case 'assignment_changed':
        return <User className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground/40 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/90 truncate">
          {activity.description || activity.title}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          {activity.admin?.first_name && ` • ${activity.admin.first_name}`}
        </p>
      </div>
    </div>
  );
}
