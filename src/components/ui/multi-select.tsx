
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

interface MultiSelectProps {
  options: Array<{ value: string; label: string; }>;
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onSelectedChange,
  placeholder = "Select options...",
  maxSelected,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = React.useCallback((item: string) => {
    onSelectedChange(selected.filter((i) => i !== item));
  }, [selected, onSelectedChange]);

  const handleSelect = React.useCallback((item: string) => {
    if (selected.includes(item)) {
      handleUnselect(item);
    } else {
      if (maxSelected && selected.length >= maxSelected) {
        return;
      }
      onSelectedChange([...selected, item]);
    }
  }, [selected, onSelectedChange, maxSelected, handleUnselect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center min-w-0">
            {selected.length > 0 ? (
              <span className="text-sm truncate">
                {selected.length === 1 
                  ? options.find(opt => opt.value === selected[0])?.label 
                  : `${selected.length} selected`
                }
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[200] w-full p-0 bg-background border shadow-md pointer-events-auto">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(option.value) ? "opacity-100" : "opacity-0"
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
  );
}
