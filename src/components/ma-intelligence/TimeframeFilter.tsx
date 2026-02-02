import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, format } from "date-fns";

export type TimeframeOption = 'today' | 'week' | 'month' | 'quarter' | 'all';

interface TimeframeFilterProps {
  value: TimeframeOption;
  onChange: (value: TimeframeOption) => void;
}

export const getDateRange = (timeframe: TimeframeOption): { start: Date | null; end: Date } => {
  const now = new Date();
  const end = now;
  let start: Date | null;

  switch (timeframe) {
    case 'today':
      start = startOfDay(now);
      break;
    case 'week':
      start = startOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      start = startOfMonth(now);
      break;
    case 'quarter':
      start = startOfQuarter(now);
      break;
    default:
      start = null;
  }
  return { start, end };
};

export const getDateRangeLabel = (timeframe: TimeframeOption): string => {
  const { start, end } = getDateRange(timeframe);
  if (!start) return "All time";
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
};

export function TimeframeFilter({ value, onChange }: TimeframeFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeframeOption)}>
      <SelectTrigger className="w-[140px] h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
        <SelectItem value="quarter">This Quarter</SelectItem>
        <SelectItem value="all">All Time</SelectItem>
      </SelectContent>
    </Select>
  );
}
