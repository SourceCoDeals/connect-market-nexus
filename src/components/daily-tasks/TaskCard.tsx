import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [detailOpen, setDetailOpen] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isOverdue = task.status === 'overdue';
  const isCompleted = task.status === 'completed';

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleCheck = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isCompleted) {
      toggleComplete.mutate({ taskId: task.id, completed: false });
    } else {
      toggleComplete.mutate({ taskId: task.id, completed: true });
      setJustCompleted(true);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setJustCompleted(false), 5000);
    }
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <>
      {/* ── Compact card: checkbox + title only ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setDetailOpen(true)}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer',
          isCompleted && 'opacity-60 bg-muted/30',
          isOverdue && !isCompleted && 'border-red-300 bg-red-50/50',
          !isCompleted && !isOverdue && 'bg-card hover:shadow-sm border-border',
          justCompleted && 'bg-green-50/50 border-green-300',
        )}
      >
        {/* Checkbox */}
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => handleCheck()}
            disabled={toggleComplete.isPending}
            className={cn('h-5 w-5', isOverdue && 'border-red-400')}
          />
        </div>

        {/* Title */}
        <span
          className={cn(
            'flex-1 text-sm font-medium leading-tight truncate',
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

        {/* Pin indicator */}
        {task.is_pinned && !isCompleted && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}

        {/* Undo inline */}
        {justCompleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-green-700 hover:text-green-900 shrink-0"
            onClick={handleUndo}
          >
            Undo
          </Button>
        )}

        {/* Three-dot menu */}
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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

      {/* ── Detail popup ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug pr-6">{task.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Description */}
            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Task type */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <Badge
                  variant="outline"
                  className={cn('text-xs', TASK_TYPE_COLORS[task.task_type])}
                >
                  {TASK_TYPE_LABELS[task.task_type]}
                </Badge>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={isOverdue ? 'destructive' : isCompleted ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {isOverdue
                    ? 'Overdue'
                    : isCompleted
                      ? 'Completed'
                      : task.status === 'pending_approval'
                        ? 'Awaiting Approval'
                        : 'Pending'}
                </Badge>
              </div>

              {/* Assignee */}
              {assigneeName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Assigned to</p>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    {assigneeName}
                  </span>
                </div>
              )}

              {/* Deal */}
              {dealName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Deal</p>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {dealName}
                    {ebitda != null && (
                      <span className="text-xs text-muted-foreground">
                        ({formatCurrency(ebitda)} EBITDA)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Due date */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due</p>
                <span className={cn('text-sm', isOverdue && 'text-red-600 font-medium')}>
                  {formatDistanceToNow(new Date(task.due_date + 'T23:59:59'), { addSuffix: true })}
                </span>
              </div>

              {/* Priority */}
              {task.priority_rank && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Priority</p>
                  <span className="text-sm font-medium">
                    #{task.priority_rank}
                    {task.is_pinned && (
                      <Pin className="inline h-3 w-3 ml-1 text-amber-500 -mt-0.5" />
                    )}
                    <span className="text-muted-foreground font-normal ml-1.5">
                      (score: {task.priority_score?.toFixed(0)})
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Pin reason */}
            {task.is_pinned && task.pin_reason && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Pinned:</span> {task.pin_reason}
                </p>
              </div>
            )}

            {/* Transcript link */}
            {task.source_meeting?.transcript_url && (
              <a
                href={task.source_meeting.transcript_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Standup Transcript
              </a>
            )}

            {/* Source meeting */}
            {task.source_meeting && (
              <p className="text-xs text-muted-foreground">
                From: {task.source_meeting.meeting_title}
                {task.source_timestamp && ` (at ${task.source_timestamp})`}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
