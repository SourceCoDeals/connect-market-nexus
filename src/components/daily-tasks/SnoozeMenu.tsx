/**
 * SnoozeMenu — Dropdown menu with snooze presets for a task.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlarmClock } from 'lucide-react';
import { useSnoozeTask } from '@/hooks/useTaskActions';
import { useToast } from '@/hooks/use-toast';
import { SNOOZE_PRESETS } from '@/types/daily-tasks';

interface SnoozeMenuProps {
  taskId: string;
  /** Rendered as a dropdown inside a parent menu */
  asMenuItem?: boolean;
}

export function SnoozeMenu({ taskId }: SnoozeMenuProps) {
  const snooze = useSnoozeTask();
  const { toast } = useToast();

  const handleSnooze = async (days: number, label: string) => {
    try {
      await snooze.mutateAsync({ taskId, days });
      toast({ title: `Task snoozed for ${label}` });
    } catch (err) {
      toast({
        title: 'Failed to snooze',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <AlarmClock className="h-3.5 w-3.5" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SNOOZE_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.days}
            onClick={() => handleSnooze(preset.days, preset.label)}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
