import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DateValue = Date | string | { min?: Date | string; max?: Date | string } | number | null;

interface DateValueInputProps {
  value: DateValue;
  onChange: (value: DateValue) => void;
  dual?: boolean;
  isLastNDays?: boolean;
}

export function DateValueInput({ value, onChange, dual, isLastNDays }: DateValueInputProps) {
  if (isLastNDays) {
    const numericValue = typeof value === 'number' || typeof value === 'string' ? value : '';
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={numericValue ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="N"
          className="h-8 text-sm w-[70px]"
          min={1}
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>
    );
  }

  if (dual) {
    const rangeValue = (
      typeof value === 'object' && value !== null && !(value instanceof Date) ? value : {}
    ) as { min?: Date | string; max?: Date | string };
    return (
      <div className="flex items-center gap-1.5">
        <SingleDatePicker
          value={rangeValue.min}
          onChange={(d) => onChange({ ...rangeValue, min: d })}
          placeholder="From"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <SingleDatePicker
          value={rangeValue.max}
          onChange={(d) => onChange({ ...rangeValue, max: d })}
          placeholder="To"
        />
      </div>
    );
  }

  const singleValue = value instanceof Date || typeof value === 'string' ? value : undefined;
  return (
    <SingleDatePicker
      value={singleValue}
      onChange={(d) => onChange(d ?? null)}
      placeholder="Pick date"
    />
  );
}

function SingleDatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: Date | string | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? (typeof value === 'string' ? new Date(value) : value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-8 text-sm w-[120px] justify-start font-normal',
            !date && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, 'MM/dd/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
