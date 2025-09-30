import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_TAGS } from "@/constants/statusTags";
import { cn } from "@/lib/utils";

interface StatusTagSwitcherProps {
  currentValue: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

export function StatusTagSwitcher({ 
  currentValue, 
  onChange, 
  className
}: StatusTagSwitcherProps) {
  const handleSelectChange = (value: string) => {
    onChange(value === "none" ? null : value);
  };

  return (
    <Select value={currentValue || "none"} onValueChange={handleSelectChange}>
      <SelectTrigger className={cn("h-9 text-xs bg-popover border shadow-sm", className)}>
        <SelectValue placeholder="Select status..." />
      </SelectTrigger>
      <SelectContent className="bg-popover text-popover-foreground border shadow-lg z-50">
        <SelectItem value="none">No Status</SelectItem>
        {STATUS_TAGS.map((tag) => (
          <SelectItem key={tag.value} value={tag.value}>
            {tag.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}