import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { INVESTMENT_RANGES } from "@/lib/currency-ranges";

interface InvestmentSizeSelectProps {
  value: string | string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  multiSelect?: boolean;
}

export function InvestmentSizeSelect({
  value,
  onValueChange,
  placeholder = "Select investment size...",
  className,
  multiSelect = true,
}: InvestmentSizeSelectProps) {
  const [open, setOpen] = React.useState(false);
  
  // Normalize value to array for consistent handling
  const selectedValues = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value;
    }
    return value ? [value] : [];
  }, [value]);

  const handleUnselect = React.useCallback((item: string) => {
    const newSelected = selectedValues.filter((i) => i !== item);
    onValueChange(newSelected);
  }, [selectedValues, onValueChange]);

  const handleSelect = React.useCallback((item: string) => {
    if (multiSelect) {
      if (selectedValues.includes(item)) {
        handleUnselect(item);
      } else {
        onValueChange([...selectedValues, item]);
      }
    } else {
      // Single select mode
      onValueChange([item]);
      setOpen(false);
    }
  }, [selectedValues, onValueChange, multiSelect, handleUnselect]);

  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      return INVESTMENT_RANGES.find(opt => opt.value === selectedValues[0])?.label || selectedValues[0];
    }
    return `${selectedValues.length} ranges selected`;
  }, [selectedValues, placeholder]);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center min-w-0">
              <span className={cn(
                "text-sm truncate",
                selectedValues.length === 0 && "text-muted-foreground"
              )}>
                {displayText}
              </span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[200] w-full p-0 bg-background border shadow-md pointer-events-auto">
          <Command>
            <CommandInput placeholder="Search investment ranges..." />
            <CommandList>
              <CommandEmpty>No investment ranges found.</CommandEmpty>
              <CommandGroup>
                {INVESTMENT_RANGES.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Show selected badges for multi-select */}
      {multiSelect && selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((item) => {
            const option = INVESTMENT_RANGES.find(opt => opt.value === item);
            return (
              <Badge
                key={item}
                variant="secondary"
                className="text-xs"
              >
                {option?.label || item}
                <button
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(item);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(item)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}