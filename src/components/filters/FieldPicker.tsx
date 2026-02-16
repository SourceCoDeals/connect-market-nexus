import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { FilterFieldDef } from "./filter-definitions";

interface FieldPickerProps {
  fields: FilterFieldDef[];
  onSelect: (field: FilterFieldDef) => void;
  compact?: boolean;
}

export function FieldPicker({ fields, onSelect, compact }: FieldPickerProps) {
  const [open, setOpen] = useState(false);

  // Group fields by their group property
  const groups = fields.reduce(
    (acc, field) => {
      if (!acc[field.group]) acc[field.group] = [];
      acc[field.group].push(field);
      return acc;
    },
    {} as Record<string, FilterFieldDef[]>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={compact ? "h-7 text-xs px-2" : "h-8 text-sm px-3"}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields..." className="h-9" />
          <CommandList>
            <CommandEmpty>No fields found.</CommandEmpty>
            {Object.entries(groups).map(([group, groupFields]) => (
              <CommandGroup key={group} heading={group}>
                {groupFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <CommandItem
                      key={field.key}
                      value={`${field.label} ${field.group}`}
                      onSelect={() => {
                        onSelect(field);
                        setOpen(false);
                      }}
                    >
                      {Icon && <Icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm">{field.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {field.type}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
