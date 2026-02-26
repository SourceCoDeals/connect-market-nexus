import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useReassignTask } from '@/hooks/useDailyTasks';
import type { DailyStandupTaskWithRelations } from '@/types/daily-tasks';

interface ReassignDialogProps {
  task: DailyStandupTaskWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: { id: string; name: string }[];
}

export function ReassignDialog({ task, open, onOpenChange, teamMembers }: ReassignDialogProps) {
  const reassign = useReassignTask();
  const [selectedId, setSelectedId] = useState('');

  const handleReassign = async () => {
    if (!task || !selectedId) return;
    await reassign.mutateAsync({ taskId: task.id, newAssigneeId: selectedId });
    setSelectedId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reassign Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {task && (
            <p className="text-sm text-muted-foreground">
              Reassign "{task.title}" to a different team member.
            </p>
          )}

          <div className="space-y-2">
            <Label>New Assignee</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={!selectedId || reassign.isPending}>
            {reassign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
