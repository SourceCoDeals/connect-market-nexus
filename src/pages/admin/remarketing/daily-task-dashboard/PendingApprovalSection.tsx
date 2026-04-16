import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { DailyStandupTaskWithRelations } from '@/types/daily-tasks';
import { PersonTaskGroup } from './PersonTaskGroup';
import type { TaskGroup, TaskHandlers } from './types';

interface PendingApprovalSectionProps {
  pendingApprovalTasks: DailyStandupTaskWithRelations[];
  pendingApprovalGroups: TaskGroup[];
  approvedTasksCount: number;
  isLeadership: boolean;
  isApprovingAll: boolean;
  onApproveAll: () => void;
  onApproveTask: (taskId: string) => void;
  onDismissTask: (taskId: string) => void;
  taskHandlers: TaskHandlers;
}

// A task "stales" after this many days waiting in pending_approval. There is
// no cron auto-escalation yet, so at minimum we make the stale backlog
// visible to leadership on the dashboard.
const STALE_PENDING_APPROVAL_DAYS = 7;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function PendingApprovalSection({
  pendingApprovalTasks,
  pendingApprovalGroups,
  approvedTasksCount,
  isLeadership,
  isApprovingAll,
  onApproveAll,
  onApproveTask,
  onDismissTask,
  taskHandlers,
}: PendingApprovalSectionProps) {
  if (pendingApprovalTasks.length === 0) return null;

  const staleCount = pendingApprovalTasks.filter((t) => {
    const days = daysSince(t.created_at);
    return days !== null && days >= STALE_PENDING_APPROVAL_DAYS;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-800">Awaiting Approval</h3>
          <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
            {pendingApprovalTasks.length} tasks
          </Badge>
          {staleCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-300 bg-red-50 text-red-700 text-[10px] flex items-center gap-1"
              title={`${staleCount} task${staleCount === 1 ? '' : 's'} have been awaiting approval for ${STALE_PENDING_APPROVAL_DAYS}+ days`}
            >
              <AlertTriangle className="h-3 w-3" />
              {staleCount} stale
            </Badge>
          )}
        </div>
        {isLeadership && (
          <Button size="sm" onClick={onApproveAll} disabled={isApprovingAll} className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Approve All ({pendingApprovalTasks.length})
          </Button>
        )}
      </div>

      {/* Pending approval tasks grouped by person */}
      <div className="space-y-3">
        {pendingApprovalGroups.map((group) => (
          <PersonTaskGroup
            key={group.assigneeId || 'unassigned'}
            group={group}
            isLeadership={isLeadership}
            isPendingApproval
            onApprove={onApproveTask}
            onDismiss={onDismissTask}
            {...taskHandlers}
          />
        ))}
      </div>

      {/* Divider */}
      {approvedTasksCount > 0 && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted-foreground">Approved Tasks</span>
          </div>
        </div>
      )}
    </div>
  );
}
