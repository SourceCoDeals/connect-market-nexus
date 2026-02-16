import { useState } from "react";
import { Check } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelectValueInputProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: { label: string; value: string }[];
  multi?: boolean;
  placeholder?: string;
}

export function SelectValueInput({
  value,
  onChange,
  options,
  multi,
  placeholder = "Select...",
}: SelectValueInputProps) {
  const [open, setOpen] = useState(false);
  const selected = multi
    ? Array.isArray(value)
      ? value
      : value
        ? [value]
        : []
    : value;

  const displayText = (() => {
    if (multi) {
      const arr = selected as string[];
      if (arr.length === 0) return placeholder;
      if (arr.length === 1) {
        return options.find((o) => o.value === arr[0])?.label ?? arr[0];
      }
      return `${arr.length} selected`;
    }
    if (!selected) return placeholder;
    return options.find((o) => o.value === selected)?.label ?? (selected as string);
  })();

  const handleSelect = (optionValue: string) => {
    if (multi) {
      const arr = selected as string[];
      const next = arr.includes(optionValue)
        ? arr.filter((v) => v !== optionValue)
        : [...arr, optionValue];
      onChange(next);
    } else {
      onChange(optionValue);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-8 text-sm w-[180px] justify-between font-normal"
        >
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = multi
                  ? (selected as string[]).includes(opt.value)
                  : selected === opt.value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => handleSelect(opt.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
