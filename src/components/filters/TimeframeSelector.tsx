import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TIMEFRAME_PRESETS,
  type TimeframeValue,
  type TimeframePreset,
} from "@/hooks/use-timeframe";

interface TimeframeSelectorProps {
  value: TimeframeValue;
  onChange: (value: TimeframeValue) => void;
  compact?: boolean;
}

export function TimeframeSelector({
  value,
  onChange,
  compact,
}: TimeframeSelectorProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(value.from);
  const [tempTo, setTempTo] = useState<Date | undefined>(value.to);

  const displayLabel = (() => {
    if (value.preset === "custom" && value.from && value.to) {
      return `${format(value.from, "MM/dd")} - ${format(value.to, "MM/dd")}`;
    }
    if (value.preset === "custom") return "Custom range";
    return TIMEFRAME_PRESETS.find((p) => p.key === value.preset)?.label ?? "Last 30 days";
  })();

  const handlePresetChange = (preset: string) => {
    if (preset === "custom") {
      setTempFrom(value.from);
      setTempTo(value.to);
      setCustomOpen(true);
      return;
    }
    onChange({ preset: preset as TimeframePreset });
  };

  const handleApplyCustom = () => {
    onChange({ preset: "custom", from: tempFrom, to: tempTo });
    setCustomOpen(false);
  };

  const handleClearCustom = () => {
    setTempFrom(undefined);
    setTempTo(undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <Select
          value={value.preset}
          onValueChange={handlePresetChange}
        >
          <SelectTrigger
            className={cn(
              "border-border/60 bg-background",
              compact ? "h-8 text-xs w-[140px]" : "h-9 text-sm w-[170px]"
            )}
          >
            <CalendarIcon className={cn("mr-2 text-muted-foreground", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            <SelectValue>{displayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom range popover – anchored to the select */}
        <PopoverTrigger asChild>
          <span className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-4">
            <div className="text-sm font-medium">Custom Date Range</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">From</label>
                <Calendar
                  mode="single"
                  selected={tempFrom}
                  onSelect={setTempFrom}
                  disabled={(date) =>
                    date > new Date() || (tempTo ? date > tempTo : false)
                  }
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">To</label>
                <Calendar
                  mode="single"
                  selected={tempTo}
                  onSelect={setTempTo}
                  disabled={(date) =>
                    date > new Date() || (tempFrom ? date < tempFrom : false)
                  }
                  className="rounded-md border"
                />
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCustom}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!tempFrom || !tempTo}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
