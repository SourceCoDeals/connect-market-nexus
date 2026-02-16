import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateValueInputProps {
  value: any; // Date | string | { min: Date; max: Date } | number (for last_n_days)
  onChange: (value: any) => void;
  dual?: boolean;
  isLastNDays?: boolean;
}

export function DateValueInput({
  value,
  onChange,
  dual,
  isLastNDays,
}: DateValueInputProps) {
  if (isLastNDays) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value ?? ""}
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
    return (
      <div className="flex items-center gap-1.5">
        <SingleDatePicker
          value={value?.min}
          onChange={(d) => onChange({ ...value, min: d })}
          placeholder="From"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <SingleDatePicker
          value={value?.max}
          onChange={(d) => onChange({ ...value, max: d })}
          placeholder="To"
        />
      </div>
    );
  }

  return (
    <SingleDatePicker
      value={value}
      onChange={onChange}
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
  const date = value ? (typeof value === "string" ? new Date(value) : value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 text-sm w-[120px] justify-start font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, "MM/dd/yyyy") : placeholder}
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
