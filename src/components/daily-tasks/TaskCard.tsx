import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  Pin,
  ExternalLink,
  AlertTriangle,
  Pencil,
  Trash2,
  User,
  Building2,
} from 'lucide-react';
import type { DailyTask } from '@/types/daily-tasks';
import { TASK_TYPE_CONFIG } from '@/types/daily-tasks';
import {
  useCompleteTask,
  useUncompleteTask,
  useReassignTask,
} from '@/hooks/daily-tasks/use-task-mutations';

interface TaskCardProps {
  task: DailyTask;
  teamMembers: { id: string; name: string }[];
  currentUserId?: string;
  isLeadership?: boolean;
  onEdit?: (task: DailyTask) => void;
  onDelete?: (taskId: string) => void;
  onPin?: (task: DailyTask) => void;
  onUnpin?: (taskId: string) => void;
}

export function TaskCard({
  task,
  teamMembers,
  currentUserId: _currentUserId,
  isLeadership,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
}: TaskCardProps) {
  const [showReassign, setShowReassign] = useState(false);
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const reassignTask = useReassignTask();

  const typeConfig = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.other;
  const isCompleted = task.status === 'completed';
  const isOverdue = task.status === 'overdue';
  const assignee = teamMembers.find((m) => m.id === task.assignee_id);

  const handleCheckChange = () => {
    if (isCompleted) {
      uncompleteTask.mutate(task.id);
    } else {
      completeTask.mutate(task.id);
    }
  };

  const handleReassign = (newAssigneeId: string) => {
    reassignTask.mutate({ taskId: task.id, newAssigneeId });
    setShowReassign(false);
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        isCompleted
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : isOverdue
            ? 'bg-red-50/50 border-red-200'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Rank number */}
      <div className="flex flex-col items-center gap-0.5 min-w-[32px] pt-0.5">
        <span
          className={`text-lg font-bold leading-none ${
            isCompleted
              ? 'text-gray-400 line-through'
              : isOverdue
                ? 'text-red-600'
                : 'text-gray-800'
          }`}
        >
          #{task.priority_rank || '—'}
        </span>
        {task.is_pinned && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Pin className="h-3 w-3 text-blue-500 fill-blue-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pinned{task.pin_reason ? `: ${task.pin_reason}` : ''}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Checkbox */}
      <div className="pt-1">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleCheckChange}
          disabled={completeTask.isPending || uncompleteTask.isPending}
          className="h-5 w-5"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium leading-snug ${
                isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
              }`}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Task type badge */}
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${typeConfig.bgColor} ${typeConfig.color} border-0`}
          >
            {typeConfig.label}
          </Badge>

          {/* Assignee */}
          {showReassign ? (
            <Select onValueChange={handleReassign}>
              <SelectTrigger className="h-6 text-[10px] w-32">
                <SelectValue placeholder="Reassign to..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              onClick={() => setShowReassign(true)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700"
            >
              <User className="h-3 w-3" />
              {assignee?.name || 'Unassigned'}
            </button>
          )}

          {/* Deal reference */}
          {task.deal_reference && (
            <span className="flex items-center gap-1 text-[10px] text-blue-600">
              <Building2 className="h-3 w-3" />
              {task.deal_reference}
            </span>
          )}

          {/* Overdue badge */}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Overdue
            </Badge>
          )}

          {/* Needs review */}
          {task.needs_review && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"
            >
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Needs Review
            </Badge>
          )}

          {/* Score on hover */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-gray-400 ml-auto cursor-default">
                  {task.priority_score.toFixed(1)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Priority Score: {task.priority_score.toFixed(1)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit Task
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setShowReassign(!showReassign)}>
            <User className="h-3.5 w-3.5 mr-2" />
            Reassign
          </DropdownMenuItem>
          {task.source_meeting_id && (
            <DropdownMenuItem>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              View Transcript
            </DropdownMenuItem>
          )}
          {isLeadership && (
            <>
              <DropdownMenuSeparator />
              {task.is_pinned ? (
                <DropdownMenuItem onClick={() => onUnpin?.(task.id)}>
                  <Pin className="h-3.5 w-3.5 mr-2" />
                  Unpin Task
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onPin?.(task)}>
                  <Pin className="h-3.5 w-3.5 mr-2" />
                  Pin to Rank...
                </DropdownMenuItem>
              )}
            </>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
