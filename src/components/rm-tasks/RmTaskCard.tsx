import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  ArrowRight,
  Moon,
  User,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompleteRmTask, useReopenRmTask, useDeleteRmTask } from '@/hooks/useRmTasks';
import { useToast } from '@/hooks/use-toast';
import type { RmTaskWithRelations } from '@/types/rm-tasks';
import {
  getDueDateColor,
  formatDueDate,
  getOverdueTier,
  OVERDUE_TIER_CONFIG,
} from '@/types/rm-tasks';
import { SnoozeDialog } from './SnoozeDialog';
import { CompleteTaskDialog } from './CompleteTaskDialog';

interface RmTaskCardProps {
  task: RmTaskWithRelations;
  onEdit?: (task: RmTaskWithRelations) => void;
  showEntity?: boolean;
}

export function RmTaskCard({ task, onEdit, showEntity = false }: RmTaskCardProps) {
  const { toast } = useToast();
  const completeTask = useCompleteRmTask();
  const reopenTask = useReopenRmTask();
  const deleteTask = useDeleteRmTask();

  const [showSnooze, setShowSnooze] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  const isCompleted = task.status === 'completed';
  const isClosed = task.status === 'deal_closed' || task.status === 'cancelled';
  const overdueTier = getOverdueTier(task.due_date, task.status);
  const isBlocked =
    task.depends_on && task.blocking_task && task.blocking_task.status !== 'completed';
  const ownerName = task.owner
    ? [task.owner.first_name, task.owner.last_name].filter(Boolean).join(' ') || task.owner.email
    : 'Unassigned';

  const handleToggleComplete = () => {
    if (isCompleted) {
      reopenTask.mutate(task.id, {
        onError: (err) =>
          toast({ title: 'Failed to reopen', description: String(err), variant: 'destructive' }),
      });
    } else {
      setShowComplete(true);
    }
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => toast({ title: 'Task deleted' }),
      onError: (err) =>
        toast({ title: 'Delete failed', description: String(err), variant: 'destructive' }),
    });
  };

  return (
    <>
      <Card
        className={cn(
          'transition-colors',
          isCompleted && 'opacity-60',
          isClosed && 'opacity-50 bg-muted/50',
          overdueTier === 'critical' && 'border-red-400 bg-red-50/30',
          overdueTier === 'abandoned' && 'border-red-600 bg-red-100/40',
        )}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleToggleComplete}
              disabled={isClosed || completeTask.isPending || reopenTask.isPending}
              className="mt-0.5"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCompleted && 'line-through text-muted-foreground',
                    overdueTier === 'aging' && 'italic',
                    overdueTier === 'critical' && 'font-bold',
                  )}
                >
                  {task.title}
                </span>

                {/* Priority badge */}
                {task.priority === 'high' && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    HIGH
                  </Badge>
                )}
                {task.priority === 'low' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    LOW
                  </Badge>
                )}

                {/* Source badge */}
                {task.source !== 'manual' && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {task.source}
                  </Badge>
                )}

                {/* Overdue tier badge */}
                {overdueTier && overdueTier !== 'at_risk' && (
                  <Badge
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      OVERDUE_TIER_CONFIG[overdueTier].bgColor,
                      OVERDUE_TIER_CONFIG[overdueTier].color,
                    )}
                  >
                    {OVERDUE_TIER_CONFIG[overdueTier].label}
                  </Badge>
                )}

                {/* Blocked warning */}
                {isBlocked && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300"
                  >
                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                    BLOCKED
                  </Badge>
                )}

                {/* Buyer score badge */}
                {task.buyer_deal_score != null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      task.buyer_deal_score >= 9
                        ? 'text-green-700 border-green-300'
                        : task.buyer_deal_score >= 7
                          ? 'text-blue-700 border-blue-300'
                          : task.buyer_deal_score >= 5
                            ? 'text-amber-700 border-amber-300'
                            : 'text-gray-500 border-gray-300',
                    )}
                  >
                    Score: {task.buyer_deal_score}
                  </Badge>
                )}

                {/* Status badge for non-open */}
                {task.status === 'snoozed' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Moon className="h-3 w-3 mr-0.5" />
                    Snoozed {task.snoozed_until ? `until ${task.snoozed_until}` : ''}
                  </Badge>
                )}
                {isClosed && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                    {task.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {task.due_date && (
                  <span
                    className={cn(
                      'flex items-center gap-1',
                      getDueDateColor(task.due_date, task.status),
                    )}
                  >
                    <Clock className="h-3 w-3" />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {!task.due_date && task.source === 'ai' && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    No due date
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ownerName}
                </span>
                {showEntity && (
                  <span className="flex items-center gap-1 capitalize">
                    <Link2 className="h-3 w-3" />
                    {task.entity_type}
                  </span>
                )}
              </div>

              {/* AI evidence quote (collapsible) */}
              {task.ai_evidence_quote && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowQuote(!showQuote)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showQuote ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Evidence quote
                  </button>
                  {showQuote && (
                    <div className="mt-1 p-2 bg-muted/50 rounded text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30">
                      &ldquo;{task.ai_evidence_quote}&rdquo;
                    </div>
                  )}
                </div>
              )}

              {/* Blocking task info */}
              {isBlocked && task.blocking_task && (
                <div className="mt-1.5 p-2 bg-amber-50 rounded text-xs text-amber-800 border border-amber-200">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Blocked by: <span className="font-medium">{task.blocking_task.title}</span>
                </div>
              )}

              {/* Completion notes */}
              {task.completion_notes && isCompleted && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">Outcome:</span> {task.completion_notes}
                </div>
              )}
            </div>

            {/* Actions */}
            {!isClosed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(task)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {!isCompleted && (
                    <DropdownMenuItem onClick={() => setShowComplete(true)}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Complete
                    </DropdownMenuItem>
                  )}
                  {!isCompleted && (
                    <DropdownMenuItem onClick={() => setShowSnooze(true)}>
                      <Moon className="h-4 w-4 mr-2" />
                      Snooze
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDelete(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SnoozeDialog open={showSnooze} onOpenChange={setShowSnooze} taskId={task.id} />

      <CompleteTaskDialog open={showComplete} onOpenChange={setShowComplete} taskId={task.id} />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{task.title}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
