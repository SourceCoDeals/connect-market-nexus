/**
 * TaskActivityPanel — Audit trail display for a task.
 */

import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { History } from 'lucide-react';
import { useTaskActivityLog } from '@/hooks/useTaskActivityLog';
import type { TaskActivityAction } from '@/types/daily-tasks';

const ACTION_LABELS: Record<TaskActivityAction, string> = {
  created: 'created this task',
  edited: 'edited this task',
  reassigned: 'reassigned this task',
  completed: 'completed this task',
  reopened: 'reopened this task',
  snoozed: 'snoozed this task',
  cancelled: 'cancelled this task',
  confirmed: 'confirmed this AI suggestion',
  dismissed: 'dismissed this AI suggestion',
  commented: 'added a comment',
  priority_changed: 'changed the priority',
  status_changed: 'changed the status',
  dependency_added: 'added a dependency',
};

interface TaskActivityPanelProps {
  taskId: string;
}

export function TaskActivityPanel({ taskId }: TaskActivityPanelProps) {
  const { data: entries, isLoading } = useTaskActivityLog(taskId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Activity
        </h4>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const name = entry.user
              ? `${entry.user.first_name || ''} ${entry.user.last_name || ''}`.trim() || 'Someone'
              : 'System';
            const label = ACTION_LABELS[entry.action] || entry.action;

            return (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <span>
                  <span className="font-medium">{name}</span>{' '}
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-muted-foreground ml-1">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      )}
    </div>
  );
}
