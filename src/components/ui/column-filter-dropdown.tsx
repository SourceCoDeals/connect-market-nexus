import { useState, useMemo } from "react";
import { Filter, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ColumnFilterDropdownProps {
  /** All unique values in the column */
  values: string[];
  /** Currently excluded values */
  excludedValues: Set<string>;
  /** Called with new set of excluded values */
  onExcludedChange: (excluded: Set<string>) => void;
  /** Column label for display */
  label?: string;
}

export function ColumnFilterDropdown({
  values,
  excludedValues,
  onExcludedChange,
  label = "Filter",
}: ColumnFilterDropdownProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const sortedValues = useMemo(() => {
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [values]);

  const filteredValues = useMemo(() => {
    if (!search) return sortedValues;
    const q = search.toLowerCase();
    return sortedValues.filter((v) => v.toLowerCase().includes(q));
  }, [sortedValues, search]);

  const allChecked = excludedValues.size === 0;
  const noneChecked = excludedValues.size === values.length;
  const isActive = excludedValues.size > 0;

  const toggleValue = (val: string) => {
    const next = new Set(excludedValues);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onExcludedChange(next);
  };

  const selectAll = () => onExcludedChange(new Set());
  const deselectAll = () => onExcludedChange(new Set(values));

  const clearFilter = () => {
    onExcludedChange(new Set());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center rounded p-0.5 transition-colors",
            isActive
              ? "text-primary bg-primary/10"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
          title={`Filter ${label}`}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Select All / Deselect All */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
          <button
            className="text-xs text-primary hover:underline"
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            className="text-xs text-muted-foreground hover:underline"
            onClick={deselectAll}
          >
            Deselect All
          </button>
        </div>

        {/* Checkbox list */}
        <ScrollArea className="max-h-[250px]">
          <div className="p-1">
            {filteredValues.map((val) => {
              const checked = !excludedValues.has(val);
              return (
                <label
                  key={val}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleValue(val)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">{val}</span>
                </label>
              );
            })}
            {filteredValues.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No matches
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {isActive && (
          <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {excludedValues.size} excluded
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={clearFilter}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
