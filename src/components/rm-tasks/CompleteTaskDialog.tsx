import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useCompleteRmTask } from '@/hooks/useRmTasks';
import { useToast } from '@/hooks/use-toast';

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

export function CompleteTaskDialog({ open, onOpenChange, taskId }: CompleteTaskDialogProps) {
  const { toast } = useToast();
  const completeMutation = useCompleteRmTask();
  const [notes, setNotes] = useState('');

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync({
        id: taskId,
        completion_notes: notes.trim() || undefined,
      });
      toast({ title: 'Task completed' });
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Complete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Complete Task
          </DialogTitle>
          <DialogDescription>
            What was the outcome? Recording the result helps the team track deal progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="completion-notes">Completion Notes (optional)</Label>
            <Textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Spoke with buyer, they're moving to IC next week..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={completeMutation.isPending}>
            {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
