/**
 * MissedCallButton — Quick action to log a missed call and snooze a follow-up task.
 *
 * Renders a compact button that opens a popover to create a 'contact_owner' task
 * with a future due date. Designed for deal/buyer detail page headers.
 */

import { useState } from 'react';
import { PhoneMissed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useAddEntityTask } from '@/hooks/useTaskActions';
import { addDays, format } from 'date-fns';
import type { TaskEntityType } from '@/types/daily-tasks';

const SNOOZE_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
] as const;

interface MissedCallButtonProps {
  entityType: TaskEntityType;
  entityId: string;
  entityName?: string;
  dealId?: string;
}

export function MissedCallButton({
  entityType,
  entityId,
  entityName,
  dealId,
}: MissedCallButtonProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const addTask = useAddEntityTask();

  const handleLogAndSnooze = async () => {
    if (selectedDays === null) return;

    const snoozedDate = format(addDays(new Date(), selectedDays), 'yyyy-MM-dd');
    const title = `Follow-up call — ${entityName || 'Unknown'}`;

    try {
      await addTask.mutateAsync({
        title,
        description: notes.trim() || 'Missed call — no answer',
        assignee_id: user?.id || null,
        task_type: 'contact_owner',
        due_date: snoozedDate,
        priority: 'high',
        entity_type: entityType,
        entity_id: entityId,
        deal_id: dealId || null,
      });

      const label =
        SNOOZE_OPTIONS.find((o) => o.days === selectedDays)?.label || `in ${selectedDays} days`;
      toast({ title: `Missed call logged — follow-up ${label}` });
      setOpen(false);
      setNotes('');
      setSelectedDays(null);
    } catch (err) {
      toast({
        title: 'Failed to log missed call',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <PhoneMissed className="h-3.5 w-3.5" />
          Missed Call
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Log Missed Call</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Follow-up call — {entityName || 'Unknown'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Snooze until</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {SNOOZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.days}
                  variant={selectedDays === opt.days ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSelectedDays(opt.days)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="missed-call-notes" className="text-xs">
              Notes (optional)
            </Label>
            <Input
              id="missed-call-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Left voicemail, try again..."
              className="h-8 text-xs"
            />
          </div>

          <Button
            size="sm"
            className="w-full text-xs"
            disabled={selectedDays === null || addTask.isPending}
            onClick={handleLogAndSnooze}
          >
            {addTask.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Log & Snooze
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
