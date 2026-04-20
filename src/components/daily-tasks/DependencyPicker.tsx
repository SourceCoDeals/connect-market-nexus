/**
 * DependencyPicker — Select which existing tasks a task depends on.
 *
 * Writes a comma-separated list of task UUIDs into the `depends_on` column,
 * matching the storage format already read by TaskDependencyView.
 *
 * Candidates are open tasks on the same deal (entity_type='deal', entity_id=dealId),
 * excluding the task being edited to prevent self-dependency.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Link2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

interface DependencyPickerProps {
  /** Deal ID whose tasks are dependency candidates. Required; picker is gated to deals only. */
  dealId: string;
  /** Current depends_on value (comma-separated task UUIDs, or null). */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Task being edited — excluded from candidates to prevent self-dependency. */
  excludeTaskId?: string;
}

interface CandidateTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

export function DependencyPicker({
  dealId,
  value,
  onChange,
  excludeTaskId,
}: DependencyPickerProps) {
  const [open, setOpen] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ['dependency-picker-candidates', dealId, excludeTaskId],
    enabled: !!dealId,
    queryFn: async (): Promise<CandidateTask[]> => {
      const { data, error } = await supabase
        .from('daily_standup_tasks' as never)
        .select('id, title, status, due_date')
        .eq('entity_type', 'deal')
        .eq('entity_id', dealId)
        .not('status', 'in', '("cancelled","listing_closed","completed")')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      const rows = (data || []) as CandidateTask[];
      return excludeTaskId ? rows.filter((r) => r.id !== excludeTaskId) : rows;
    },
    staleTime: 30_000,
  });

  const selectedIds = useMemo(() => {
    if (!value) return new Set<string>();
    return new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [value]);

  const selectedTasks = useMemo<CandidateTask[]>(() => {
    if (!candidates) return [];
    return candidates.filter((t) => selectedIds.has(t.id));
  }, [candidates, selectedIds]);

  const hasCandidates = (candidates?.length ?? 0) > 0;

  // When there are no candidates AND no current selection, render nothing —
  // no point showing an empty picker for a brand-new deal.
  if (!hasCandidates && selectedIds.size === 0) return null;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nextValue = Array.from(next).join(',');
    onChange(nextValue || null);
  };

  const clearOne = (id: string) => {
    const next = new Set(selectedIds);
    next.delete(id);
    const nextValue = Array.from(next).join(',');
    onChange(nextValue || null);
  };

  return (
    <div className="space-y-2">
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTasks.map((t) => (
            <Badge key={t.id} variant="secondary" className="text-xs gap-1 pr-1 font-normal">
              <Link2 className="h-3 w-3" />
              <span className="max-w-[220px] truncate">{t.title}</span>
              <button
                type="button"
                onClick={() => clearOne(t.id)}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove dependency: ${t.title}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Show dangling selections (picker was populated from IDs we don't have in
          candidates — e.g. a completed prereq that's no longer in the query). */}
      {selectedIds.size > selectedTasks.length && (
        <p className="text-[10px] text-muted-foreground">
          {selectedIds.size - selectedTasks.length} dependency
          {selectedIds.size - selectedTasks.length === 1 ? '' : 'ies'} on completed/archived tasks —
          use Clear if you want to detach.
        </p>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-xs font-normal h-8"
            disabled={!hasCandidates}
          >
            {selectedIds.size === 0
              ? hasCandidates
                ? 'Select prerequisite tasks…'
                : 'No open tasks on this deal yet'
              : `${selectedIds.size} prerequisite${selectedIds.size === 1 ? '' : 's'} selected`}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tasks…" className="text-xs h-8" />
            <CommandList>
              <CommandEmpty className="text-xs py-4 text-center text-muted-foreground">
                No open tasks to depend on.
              </CommandEmpty>
              <CommandGroup>
                {candidates?.map((t) => {
                  const selected = selectedIds.has(t.id);
                  return (
                    <CommandItem
                      key={t.id}
                      value={t.title}
                      onSelect={() => toggle(t.id)}
                      className="text-xs gap-2"
                    >
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.due_date && (
                        <span
                          className={cn(
                            'text-[10px] tabular-nums shrink-0',
                            t.status === 'overdue' ? 'text-red-600' : 'text-muted-foreground',
                          )}
                        >
                          {t.due_date}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
