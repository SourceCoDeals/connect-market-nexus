import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangeFilterProps {
  label: string;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export function DateRangeFilter({ label, range, onRangeChange }: DateRangeFilterProps) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">{label}</label>
      <div className="space-y-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !range.start && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {range.start ? format(range.start, 'PPP') : <span>Start date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={range.start || undefined}
              onSelect={(date) => onRangeChange({ ...range, start: date || null })}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !range.end && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {range.end ? format(range.end, 'PPP') : <span>End date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={range.end || undefined}
              onSelect={(date) => onRangeChange({ ...range, end: date || null })}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
