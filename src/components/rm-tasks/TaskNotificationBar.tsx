import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRmTaskCounts } from '@/hooks/useRmTasks';
import { useState } from 'react';

export function TaskNotificationBar() {
  const { data: counts } = useRmTaskCounts();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  if (!counts) return null;

  const showOverdue = counts.overdue > 0 && !dismissed['overdue'];
  const showDueToday = counts.dueToday > 0 && !dismissed['today'];

  if (!showOverdue && !showDueToday) return null;

  return (
    <div className="space-y-0">
      {showOverdue && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-200 text-red-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>
              <span className="font-semibold">
                {counts.overdue} task{counts.overdue !== 1 ? 's' : ''}
              </span>{' '}
              overdue
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/tasks?view=overdue">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-red-700 hover:text-red-900 hover:bg-red-100"
              >
                View
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-400 hover:text-red-600"
              onClick={() => setDismissed((d) => ({ ...d, overdue: true }))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {showDueToday && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              <span className="font-semibold">
                {counts.dueToday} task{counts.dueToday !== 1 ? 's' : ''}
              </span>{' '}
              due today
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/tasks?view=due_today">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
              >
                View
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-400 hover:text-amber-600"
              onClick={() => setDismissed((d) => ({ ...d, today: true }))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
