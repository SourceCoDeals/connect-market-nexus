import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_TAGS } from "@/constants/statusTags";
import { cn } from "@/lib/utils";

interface StatusTagSwitcherProps {
  currentValue: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  compact?: boolean;
}

export function StatusTagSwitcher({ 
  currentValue, 
  onChange, 
  className,
  compact = false 
}: StatusTagSwitcherProps) {
  const handleToggleChange = (value: string) => {
    onChange(value === "none" ? null : value);
  };

  const handleSelectChange = (value: string) => {
    onChange(value === "none" ? null : value);
  };

  if (compact) {
    return (
      <Select value={currentValue || "none"} onValueChange={handleSelectChange}>
        <SelectTrigger className={cn("h-9 text-xs bg-popover border shadow-sm", className)}>
          <SelectValue />
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

  return (
    <div className={cn("w-full", className)}>
      <ToggleGroup
        type="single"
        value={currentValue || "none"}
        onValueChange={handleToggleChange}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full gap-2 p-1"
      >
        <ToggleGroupItem
          value="none"
          className="h-9 px-3 text-xs bg-muted/50 hover:bg-muted text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:border-border data-[state=on]:shadow-sm transition-all"
        >
          None
        </ToggleGroupItem>
        {STATUS_TAGS.map((tag) => (
          <ToggleGroupItem
            key={tag.value}
            value={tag.value}
            className="h-9 px-3 text-xs bg-muted/50 hover:bg-muted text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:border-border data-[state=on]:shadow-sm transition-all"
          >
            {tag.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}