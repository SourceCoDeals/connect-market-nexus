import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useEditTask } from '@/hooks/useDailyTasks';
import { useExistingTags } from '@/hooks/useTaskTags';
import { Link2 } from 'lucide-react';
import { TASK_TYPE_OPTIONS, DEAL_TASK_TYPE_OPTIONS } from '@/types/daily-tasks';
import { TagInput } from './TagInput';
import { DependencyPicker } from './DependencyPicker';
import type { DailyStandupTaskWithRelations, TaskType, TaskEntityType } from '@/types/daily-tasks';

interface EditTaskDialogProps {
  task: DailyStandupTaskWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: TaskEntityType;
}

export function EditTaskDialog({ task, open, onOpenChange, entityType }: EditTaskDialogProps) {
  const taskTypeOptions = entityType === 'deal' ? DEAL_TASK_TYPE_OPTIONS : TASK_TYPE_OPTIONS;
  const editTask = useEditTask();
  const { toast } = useToast();
  const { data: existingTags } = useExistingTags();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('other');
  const [dueDate, setDueDate] = useState('');
  const [dealReference, setDealReference] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dependsOn, setDependsOn] = useState<string | null>(null);

  // Resolve the deal ID used to scope dependency candidates. Prefer the
  // task's explicit deal linkage, falling back to entity_id when the task
  // is a deal-scoped entity task.
  const dependencyDealId =
    task?.deal_id ?? (task?.entity_type === 'deal' ? task.entity_id : null) ?? null;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setTaskType(task.task_type);
      setDueDate(task.due_date);
      setDealReference(task.deal_reference || '');
      setTags(task.tags || []);
      setDependsOn(task.depends_on ?? null);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task || !title.trim()) return;

    try {
      await editTask.mutateAsync({
        taskId: task.id,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          task_type: taskType,
          due_date: dueDate,
          deal_reference: dealReference.trim() || null,
          tags,
          depends_on: dependsOn,
        },
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to save changes',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Task Title *</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dueDate">Due Date</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-dealRef">Deal Reference</Label>
            <Input
              id="edit-dealRef"
              value={dealReference}
              onChange={(e) => setDealReference(e.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={existingTags || []}
              placeholder="e.g., Q1 push, board meeting prep"
            />
          </div>

          {/* Dependencies — only for deal-scoped tasks. */}
          {dependencyDealId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Depends on
              </Label>
              <DependencyPicker
                dealId={dependencyDealId}
                value={dependsOn}
                onChange={setDependsOn}
                excludeTaskId={task?.id}
              />
              {dependsOn && (
                <p className="text-[11px] text-muted-foreground">
                  Blocked until the selected task{dependsOn.includes(',') ? 's are' : ' is'}{' '}
                  completed.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || editTask.isPending}>
            {editTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
