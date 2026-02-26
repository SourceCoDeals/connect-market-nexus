import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useAddManualTask } from '@/hooks/useDailyTasks';
import { TASK_TYPE_OPTIONS } from '@/types/daily-tasks';
import type { TaskType } from '@/types/daily-tasks';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: { id: string; name: string }[];
}

export function AddTaskDialog({ open, onOpenChange, teamMembers }: AddTaskDialogProps) {
  const addTask = useAddManualTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('other');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dealReference, setDealReference] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) return;

    await addTask.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      assignee_id: assigneeId || null,
      task_type: taskType,
      due_date: dueDate,
      deal_reference: dealReference.trim() || null,
      deal_id: null,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setTaskType('other');
    setDueDate(new Date().toISOString().split('T')[0]);
    setDealReference('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Call the owner of Smith Manufacturing"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dealRef">Deal Reference</Label>
              <Input
                id="dealRef"
                value={dealReference}
                onChange={(e) => setDealReference(e.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || addTask.isPending}>
            {addTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
