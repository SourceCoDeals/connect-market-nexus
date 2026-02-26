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
import { Loader2 } from 'lucide-react';
import { usePinTask } from '@/hooks/useDailyTasks';
import type { DailyStandupTaskWithRelations } from '@/types/daily-tasks';

interface PinDialogProps {
  task: DailyStandupTaskWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PinDialog({ task, open, onOpenChange }: PinDialogProps) {
  const pinTask = usePinTask();
  const [rank, setRank] = useState('1');
  const [reason, setReason] = useState('');

  const isCurrentlyPinned = task?.is_pinned;

  const handlePin = async () => {
    if (!task) return;

    if (isCurrentlyPinned) {
      await pinTask.mutateAsync({ taskId: task.id, rank: null });
    } else {
      const rankNum = parseInt(rank, 10);
      if (isNaN(rankNum) || rankNum < 1) return;
      await pinTask.mutateAsync({
        taskId: task.id,
        rank: rankNum,
        reason: reason.trim() || undefined,
      });
    }

    setRank('1');
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isCurrentlyPinned ? 'Unpin Task' : 'Pin Task to Rank'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {task && (
            <p className="text-sm text-muted-foreground">
              {isCurrentlyPinned
                ? `"${task.title}" is currently pinned at rank #${task.pinned_rank}. Unpinning will let the algorithm rank it naturally.`
                : `Pin "${task.title}" to a specific rank position.`}
            </p>
          )}

          {!isCurrentlyPinned && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin-rank">Desired Rank Position</Label>
                <Input
                  id="pin-rank"
                  type="number"
                  min={1}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin-reason">Reason (optional)</Label>
                <Textarea
                  id="pin-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this being prioritized?"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePin} disabled={pinTask.isPending}>
            {pinTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCurrentlyPinned ? 'Unpin' : 'Pin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
