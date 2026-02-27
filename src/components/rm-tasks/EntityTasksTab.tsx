import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CheckSquare, Rocket } from 'lucide-react';
import { useEntityRmTasks } from '@/hooks/useRmTasks';
import type { RmTaskEntityType, RmTaskWithRelations } from '@/types/rm-tasks';
import { RmTaskCard } from './RmTaskCard';
import { CreateTaskDialog } from './CreateTaskDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { StartDealProcessDialog } from './StartDealProcessDialog';

interface EntityTasksTabProps {
  entityType: RmTaskEntityType;
  entityId: string;
  entityName?: string;
}

export function EntityTasksTab({ entityType, entityId, entityName }: EntityTasksTabProps) {
  const { data: tasks, isLoading } = useEntityRmTasks(entityType, entityId);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [editingTask, setEditingTask] = useState<RmTaskWithRelations | null>(null);

  const openTasks = (tasks ?? []).filter((t) => t.status === 'open' || t.status === 'in_progress');
  const completedTasks = (tasks ?? []).filter((t) => t.status === 'completed');
  const closedTasks = (tasks ?? []).filter(
    (t) => t.status === 'cancelled' || t.status === 'deal_closed' || t.status === 'snoozed',
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Tasks ({openTasks.length} open)</h3>
        </div>
        <div className="flex items-center gap-2">
          {entityType === 'deal' && (
            <Button variant="outline" size="sm" onClick={() => setShowTemplate(true)}>
              <Rocket className="h-3.5 w-3.5 mr-1.5" />
              Start Deal Process
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Open tasks */}
      {openTasks.length > 0 ? (
        <div className="space-y-2">
          {openTasks.map((task) => (
            <RmTaskCard key={task.id} task={task} onEdit={(t) => setEditingTask(t)} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No open tasks</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create First Task
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Completed ({completedTasks.length})
          </h4>
          {completedTasks.map((task) => (
            <RmTaskCard key={task.id} task={task} onEdit={(t) => setEditingTask(t)} />
          ))}
        </div>
      )}

      {/* Closed/cancelled tasks */}
      {closedTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Closed ({closedTasks.length})
          </h4>
          {closedTasks.map((task) => (
            <RmTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultEntityType={entityType}
        defaultEntityId={entityId}
        defaultEntityName={entityName}
      />

      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
      />

      {entityType === 'deal' && (
        <StartDealProcessDialog
          open={showTemplate}
          onOpenChange={setShowTemplate}
          dealId={entityId}
          dealName={entityName}
        />
      )}
    </div>
  );
}
