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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useCreateRmTask, useTeamMembers } from '@/hooks/useRmTasks';
import type { RmTaskEntityType, RmTaskPriority } from '@/types/rm-tasks';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: RmTaskEntityType;
  defaultEntityId?: string;
  defaultEntityName?: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultEntityType,
  defaultEntityId,
  defaultEntityName,
}: CreateTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createTask = useCreateRmTask();
  const { data: teamMembers = [] } = useTeamMembers();

  const [title, setTitle] = useState('');
  const [entityType, setEntityType] = useState<RmTaskEntityType>(defaultEntityType ?? 'deal');
  const [entityId, setEntityId] = useState(defaultEntityId ?? '');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
  });
  const [priority, setPriority] = useState<RmTaskPriority>('medium');
  const [ownerId, setOwnerId] = useState(user?.id ?? '');
  const [notes, setNotes] = useState('');

  const isLocked = !!defaultEntityType && !!defaultEntityId;

  const resetForm = () => {
    setTitle('');
    setEntityType(defaultEntityType ?? 'deal');
    setEntityId(defaultEntityId ?? '');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toLocaleDateString('en-CA'));
    setPriority('medium');
    setOwnerId(user?.id ?? '');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !entityId) return;

    try {
      await createTask.mutateAsync({
        title: title.trim(),
        entity_type: entityType,
        entity_id: entityId,
        due_date: dueDate,
        priority,
        owner_id: ownerId || user!.id,
        notes: notes.trim() || null,
      });
      toast({ title: 'Task created' });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to create task',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Start with an action verb (e.g., Follow up with...)"
              maxLength={200}
            />
          </div>

          {isLocked ? (
            <div className="space-y-2">
              <Label>Linked Record</Label>
              <div className="text-sm p-2 bg-muted rounded-md">
                <span className="capitalize font-medium">{entityType}</span>
                {defaultEntityName && (
                  <span className="text-muted-foreground"> — {defaultEntityName}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type *</Label>
                <Select
                  value={entityType}
                  onValueChange={(v) => setEntityType(v as RmTaskEntityType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal">Deal</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entity ID *</Label>
                <Input
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Record UUID"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due Date *</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as RmTaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !entityId || !dueDate || createTask.isPending}
          >
            {createTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
