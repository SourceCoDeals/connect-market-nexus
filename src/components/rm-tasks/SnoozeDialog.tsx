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
import { Loader2, Moon } from 'lucide-react';
import { useSnoozeRmTask } from '@/hooks/useRmTasks';
import { useToast } from '@/hooks/use-toast';
import { SNOOZE_PRESETS, type SnoozePreset } from '@/types/rm-tasks';

interface SnoozeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
}

export function SnoozeDialog({ open, onOpenChange, taskId }: SnoozeDialogProps) {
  const { toast } = useToast();
  const snoozeMutation = useSnoozeRmTask();
  const [selected, setSelected] = useState<SnoozePreset>('1_week');
  const [customDate, setCustomDate] = useState(addDays(7));

  const handleSnooze = async () => {
    const preset = SNOOZE_PRESETS.find((p) => p.value === selected);
    const snoozedUntil = preset?.days != null ? addDays(preset.days) : customDate;

    try {
      await snoozeMutation.mutateAsync({ id: taskId, snoozed_until: snoozedUntil });
      toast({ title: 'Task snoozed', description: `Until ${snoozedUntil}` });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Snooze failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Snooze Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {SNOOZE_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={selected === preset.value ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setSelected(preset.value)}
            >
              {preset.label}
              {preset.days != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {addDays(preset.days)}
                </span>
              )}
            </Button>
          ))}

          {selected === 'custom' && (
            <div className="space-y-2 pt-2">
              <Label>Custom Date</Label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={addDays(1)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSnooze} disabled={snoozeMutation.isPending}>
            {snoozeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
