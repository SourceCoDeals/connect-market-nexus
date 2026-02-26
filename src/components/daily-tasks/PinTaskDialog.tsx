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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePinTask } from '@/hooks/daily-tasks/use-task-mutations';
import type { DailyTask } from '@/types/daily-tasks';
import { Pin, Loader2 } from 'lucide-react';

interface PinTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DailyTask | null;
  currentUserId: string;
}

export function PinTaskDialog({ open, onOpenChange, task, currentUserId }: PinTaskDialogProps) {
  const [rank, setRank] = useState(1);
  const [reason, setReason] = useState('');
  const pinTask = usePinTask();

  const handleSubmit = () => {
    if (!task || rank < 1) return;
    pinTask.mutate(
      {
        taskId: task.id,
        rank,
        reason: reason.trim() || undefined,
        performedBy: currentUserId,
      },
      {
        onSuccess: () => {
          setRank(1);
          setReason('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4" />
            Pin Task to Rank
          </DialogTitle>
        </DialogHeader>

        {task && (
          <div className="space-y-4 py-2">
            <div className="p-2 rounded bg-gray-50 text-sm text-gray-700">{task.title}</div>

            <div className="space-y-1.5">
              <Label htmlFor="rank">Rank Position</Label>
              <Input
                id="rank"
                type="number"
                min={1}
                value={rank}
                onChange={(e) => setRank(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-gray-500">This task will be locked to position #{rank}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being prioritized?"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!task || rank < 1 || pinTask.isPending}>
            {pinTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Pin to #{rank}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
