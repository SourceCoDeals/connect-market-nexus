import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  useUniversalSearch,
  CATEGORY_CONFIG,
  type SearchResultCategory,
} from '@/hooks/admin/use-universal-search';
import {
  Building2,
  Crosshair,
  Briefcase,
  Calculator,
  Mail,
  ClipboardList,
  Handshake,
  Users,
  FileText,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<SearchResultCategory, React.ReactNode> = {
  deal: <Building2 className="h-4 w-4" />,
  listing: <FileText className="h-4 w-4" />,
  captarget: <Crosshair className="h-4 w-4" />,
  gp_partner: <Briefcase className="h-4 w-4" />,
  valuation_lead: <Calculator className="h-4 w-4" />,
  inbound_lead: <Mail className="h-4 w-4" />,
  owner_lead: <ClipboardList className="h-4 w-4" />,
  referral_partner: <Handshake className="h-4 w-4" />,
  buyer: <Users className="h-4 w-4" />,
};

interface UniversalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UniversalSearchDialog({ open, onOpenChange }: UniversalSearchDialogProps) {
  const navigate = useNavigate();
  const { query, setQuery, groupedResults, totalCount, reset } = useUniversalSearch();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to let animation finish before clearing
      const t = setTimeout(() => reset(), 200);
      return () => clearTimeout(t);
    }
  }, [open, reset]);

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false);
      navigate(href);
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search across deals, leads, buyers, partners..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        {query.length >= 2 && totalCount === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p>No results found for "{query}"</p>
              <p className="text-xs text-muted-foreground">
                Try a different search term or check other sections
              </p>
            </div>
          </CommandEmpty>
        )}

        {query.length < 2 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground">Type to search across all data sources</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {CATEGORY_ICONS[key as SearchResultCategory]}
                    {cfg.pluralLabel}
                  </span>
                ))}
              </div>
            </div>
          </CommandEmpty>
        )}

        {Array.from(groupedResults.entries()).map(([category, items], idx) => {
          const cfg = CATEGORY_CONFIG[category];
          const icon = CATEGORY_ICONS[category];

          return (
            <div key={category}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup
                heading={
                  <span className={cn('flex items-center gap-1.5 font-medium', cfg.color)}>
                    {icon}
                    {cfg.pluralLabel}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({items.length})
                    </span>
                  </span>
                }
              >
                {items.map((result) => (
                  <CommandItem
                    key={`${result.category}-${result.id}`}
                    value={`${result.title} ${result.subtitle || ''} ${result.meta || ''}`}
                    onSelect={() => handleSelect(result.href)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <span className={cn('shrink-0', cfg.color)}>
                      {icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{result.title}</span>
                        {result.meta && (
                          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                            {result.meta}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {cfg.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="flex items-center justify-between px-3 py-2 border-t text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              ↵
            </kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              esc
            </kbd>
            Close
          </span>
        </div>
        {totalCount > 0 && (
          <span>
            {totalCount} result{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </CommandDialog>
  );
}
