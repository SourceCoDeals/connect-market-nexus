import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface AsyncComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface AsyncComboboxProps {
  /** Current selected value (UUID / id). */
  value: string | null;
  /** Called when the user selects an option or clears the selection. */
  onValueChange: (value: string | null, option: AsyncComboboxOption | null) => void;
  /** List of options to render (already debounced + filtered server-side). */
  options: AsyncComboboxOption[];
  /** Called when the search query changes. Parent is responsible for debouncing + fetching. */
  onSearchChange: (query: string) => void;
  /** Loading state from the parent's fetch. */
  isLoading?: boolean;
  /** Display label for the currently-selected value when it isn't in `options`. */
  selectedLabel?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

/**
 * Combobox with server-side search. Unlike the existing `Combobox`
 * (client-side filter over a static option list), this component
 * passes every search keystroke up to the parent via `onSearchChange`
 * so the parent can fetch matching rows from Supabase.
 */
export function AsyncCombobox({
  value,
  onValueChange,
  options,
  onSearchChange,
  isLoading = false,
  selectedLabel,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results',
  className,
  disabled = false,
  clearable = true,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // Reset search when closing so next open starts fresh.
  React.useEffect(() => {
    if (!open) setSearchValue('');
  }, [open]);

  // Forward every search change to parent.
  React.useEffect(() => {
    onSearchChange(searchValue);
  }, [searchValue, onSearchChange]);

  // Prefer the label from the live options list; fall back to the
  // selectedLabel prop (so we can display a value whose full row isn't
  // currently in the options array, e.g. because the search is showing
  // different results).
  const selectedInOptions = options.find((o) => o.value === value);
  const displayLabel = selectedInOptions?.label ?? selectedLabel ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !displayLabel && 'text-muted-foreground')}>
            {displayLabel ?? placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && value && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear"
                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange(null, null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onValueChange(null, null);
                  }
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 z-[100]"
        style={{ minWidth: 'var(--radix-popover-trigger-width)', maxWidth: '480px' }}
        align="start"
      >
        {/* The `shouldFilter={false}` flag tells cmdk to NOT run its internal
            filter — we rely on the server to return only matching rows. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Searching…
              </div>
            )}
            {!isLoading && options.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            {!isLoading && options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onValueChange(option.value, option);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0">
                      <div className="truncate">{option.label}</div>
                      {option.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
