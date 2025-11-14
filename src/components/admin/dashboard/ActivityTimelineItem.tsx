// No icon imports needed
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
  return (
    <div className="flex items-start gap-2">
      <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600 mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-900 dark:text-slate-100 truncate">
          {activity.description || activity.title}
        </p>
        <p className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          {activity.admin?.first_name && ` · ${activity.admin.first_name}`}
        </p>
      </div>
    </div>
  );
}
