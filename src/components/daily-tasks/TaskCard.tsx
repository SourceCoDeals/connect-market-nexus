import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MoreVertical,
  Pin,
  ExternalLink,
  Pencil,
  Trash2,
  UserRound,
  Building2,
} from 'lucide-react';
import type { DailyStandupTaskWithRelations } from '@/types/daily-tasks';
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '@/types/daily-tasks';
import { useToggleTaskComplete } from '@/hooks/useDailyTasks';

interface TaskCardProps {
  task: DailyStandupTaskWithRelations;
  isLeadership?: boolean;
  onEdit?: (task: DailyStandupTaskWithRelations) => void;
  onReassign?: (task: DailyStandupTaskWithRelations) => void;
  onPin?: (task: DailyStandupTaskWithRelations) => void;
  onDelete?: (task: DailyStandupTaskWithRelations) => void;
}

export function TaskCard({
  task,
  isLeadership,
  onEdit,
  onReassign,
  onPin,
  onDelete,
}: TaskCardProps) {
  const toggleComplete = useToggleTaskComplete();
  const [justCompleted, setJustCompleted] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isOverdue = task.status === 'overdue';
  const isCompleted = task.status === 'completed';

  // Clean up undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleCheck = () => {
    if (isCompleted) {
      toggleComplete.mutate({ taskId: task.id, completed: false });
    } else {
      toggleComplete.mutate({ taskId: task.id, completed: true });
      setJustCompleted(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setJustCompleted(false), 5000);
    }
  };

  const handleUndo = () => {
    toggleComplete.mutate({ taskId: task.id, completed: false });
    setJustCompleted(false);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const assigneeName = task.assignee
    ? `${task.assignee.first_name || ''} ${task.assignee.last_name || ''}`.trim()
    : null;

  const dealName =
    task.deal?.listings?.internal_company_name || task.deal?.listings?.title || task.deal_reference;

  const ebitda = task.deal?.listings?.ebitda;

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-all',
        isCompleted && 'opacity-60 bg-muted/30',
        isOverdue && !isCompleted && 'border-red-300 bg-red-50/50',
        !isCompleted && !isOverdue && 'bg-card hover:shadow-sm border-border',
        justCompleted && 'bg-green-50/50 border-green-300',
      )}
    >
      {/* Rank Number */}
      <div className="flex-shrink-0 w-10 pt-0.5">
        {task.priority_rank && !isCompleted ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'text-lg font-bold leading-none tabular-nums',
                    isOverdue ? 'text-red-600' : 'text-foreground',
                  )}
                >
                  #{task.priority_rank}
                  {task.is_pinned && <Pin className="inline h-3 w-3 ml-0.5 text-amber-500 -mt-2" />}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Score: {task.priority_score?.toFixed(1)}</p>
                {task.is_pinned && task.pin_reason && (
                  <p className="text-xs text-muted-foreground mt-1">Pinned: {task.pin_reason}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex-shrink-0 pt-1">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleCheck}
          disabled={toggleComplete.isPending}
          className={cn('h-5 w-5', isOverdue && 'border-red-400')}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'text-sm font-medium leading-tight',
              isCompleted && 'line-through text-muted-foreground',
            )}
          >
            {task.title}
          </span>

          {/* Overdue badge */}
          {isOverdue && !isCompleted && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
              Overdue
            </Badge>
          )}

          {/* Needs review badge */}
          {task.needs_review && !isCompleted && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 shrink-0"
            >
              Needs Review
            </Badge>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Task type */}
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 h-4', TASK_TYPE_COLORS[task.task_type])}
          >
            {TASK_TYPE_LABELS[task.task_type]}
          </Badge>

          {/* Deal name */}
          {dealName && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {dealName}
              {ebitda != null && (
                <span className="text-[10px] opacity-70">({formatCurrency(ebitda)} EBITDA)</span>
              )}
            </span>
          )}

          {/* Assignee */}
          {assigneeName && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserRound className="h-3 w-3" />
              {assigneeName}
            </span>
          )}

          {/* Due date */}
          <span
            className={cn(
              'text-[11px]',
              isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
            )}
          >
            Due {formatDistanceToNow(new Date(task.due_date + 'T23:59:59'), { addSuffix: true })}
          </span>

          {/* Transcript link */}
          {task.source_meeting?.transcript_url && (
            <a
              href={task.source_meeting.transcript_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5"
            >
              <ExternalLink className="h-3 w-3" />
              Transcript
            </a>
          )}
        </div>

        {/* Undo toast */}
        {justCompleted && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-green-700">Task completed!</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-2 text-green-700 hover:text-green-900"
              onClick={handleUndo}
            >
              Undo
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(task)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReassign?.(task)}>
              <UserRound className="h-3.5 w-3.5 mr-2" />
              Reassign
            </DropdownMenuItem>
            {isLeadership && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onPin?.(task)}>
                  <Pin className="h-3.5 w-3.5 mr-2" />
                  {task.is_pinned ? 'Unpin' : 'Pin to Rank'}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete?.(task)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
