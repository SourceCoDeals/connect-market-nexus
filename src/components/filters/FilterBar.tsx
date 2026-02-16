import { useState, useCallback } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type FilterFieldDef,
  type FilterRule,
  type FilterState,
  type Operator,
  OPERATORS_BY_TYPE,
  EMPTY_FILTER_STATE,
} from "./filter-definitions";
import { FilterRow } from "./FilterRow";
import { FilterPill } from "./FilterPill";
import { FieldPicker } from "./FieldPicker";
import { SavedViewSelector } from "./SavedViewSelector";
import { TimeframeSelector } from "./TimeframeSelector";
import type { TimeframeValue } from "@/hooks/use-timeframe";
import type { SavedView } from "@/hooks/use-saved-views";

interface FilterBarProps {
  filterState: FilterState;
  onFilterStateChange: (state: FilterState | ((prev: FilterState) => FilterState)) => void;
  fieldDefinitions: FilterFieldDef[];
  dynamicOptions: Record<string, { label: string; value: string }[]>;
  totalCount: number;
  filteredCount: number;
  // Optional timeframe integration
  timeframe?: TimeframeValue;
  onTimeframeChange?: (value: TimeframeValue) => void;
  // Optional saved views
  savedViews?: SavedView[];
  onSaveView?: (name: string, filters: FilterState) => void;
  onDeleteView?: (id: string) => void;
  onSelectView?: (view: SavedView) => void;
  // Appearance
  compact?: boolean;
  className?: string;
  /** Extra content to render after the search input (e.g., action buttons) */
  children?: React.ReactNode;
}

export function FilterBar({
  filterState,
  onFilterStateChange,
  fieldDefinitions,
  dynamicOptions,
  totalCount,
  filteredCount,
  timeframe,
  onTimeframeChange,
  savedViews,
  onSaveView,
  onDeleteView,
  onSelectView,
  compact,
  className,
  children,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      const timer = setTimeout(() => {
        onFilterStateChange((prev) => ({ ...prev, search: value }));
      }, 300);
      setSearchDebounceTimer(timer);
      // Also update local display immediately
      onFilterStateChange((prev) => ({ ...prev, search: value }));
    },
    [onFilterStateChange, searchDebounceTimer]
  );

  const addFilterRule = useCallback(
    (fieldDef: FilterFieldDef) => {
      const defaultOp = OPERATORS_BY_TYPE[fieldDef.type]?.[0]?.value ?? "contains";
      const newRule: FilterRule = {
        id: crypto.randomUUID(),
        field: fieldDef.key,
        operator: defaultOp,
        value: null,
      };
      onFilterStateChange((prev) => ({
        ...prev,
        rules: [...prev.rules, newRule],
      }));
      setExpanded(true);
    },
    [onFilterStateChange]
  );

  const updateRule = useCallback(
    (ruleId: string, updates: Partial<FilterRule>) => {
      onFilterStateChange((prev) => ({
        ...prev,
        rules: prev.rules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
      }));
    },
    [onFilterStateChange]
  );

  const removeRule = useCallback(
    (ruleId: string) => {
      onFilterStateChange((prev) => ({
        ...prev,
        rules: prev.rules.filter((r) => r.id !== ruleId),
      }));
    },
    [onFilterStateChange]
  );

  const clearAll = useCallback(() => {
    onFilterStateChange(EMPTY_FILTER_STATE);
  }, [onFilterStateChange]);

  const toggleConjunction = useCallback(() => {
    onFilterStateChange((prev) => ({
      ...prev,
      conjunction: prev.conjunction === "and" ? "or" : "and",
    }));
  }, [onFilterStateChange]);

  const handleFieldChange = useCallback(
    (ruleId: string, newFieldKey: string) => {
      const newFieldDef = fieldDefinitions.find((f) => f.key === newFieldKey);
      if (!newFieldDef) return;
      const defaultOp = OPERATORS_BY_TYPE[newFieldDef.type]?.[0]?.value ?? "contains";
      updateRule(ruleId, {
        field: newFieldKey,
        operator: defaultOp,
        value: null,
      });
    },
    [fieldDefinitions, updateRule]
  );

  const fieldMap = new Map(fieldDefinitions.map((f) => [f.key, f]));

  const getOptionsForField = (fieldDef: FilterFieldDef) => {
    if (fieldDef.options) return fieldDef.options;
    return dynamicOptions[fieldDef.key] ?? [];
  };

  const hasActiveFilters = filterState.rules.length > 0;
  const isFiltered = hasActiveFilters || filterState.search;

  return (
    <div className={cn("bg-card rounded-xl border border-border/40 shadow-sm", className)}>
      {/* Top bar: Search + pills + controls */}
      <div className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 h-9 bg-background border-border/60 focus:border-primary/50"
                value={filterState.search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Timeframe selector */}
            {timeframe && onTimeframeChange && (
              <TimeframeSelector
                value={timeframe}
                onChange={onTimeframeChange}
                compact={compact}
              />
            )}

            {/* Add filter button */}
            <FieldPicker
              fields={fieldDefinitions}
              onSelect={addFilterRule}
              compact={compact}
            />

            {/* Saved views */}
            {savedViews && onSaveView && onDeleteView && onSelectView && (
              <SavedViewSelector
                views={savedViews}
                onSelect={(view) => {
                  onSelectView(view);
                  onFilterStateChange(view.filters);
                }}
                onSave={onSaveView}
                onDelete={onDeleteView}
                currentFilters={filterState}
              />
            )}

            {/* Page-specific action buttons */}
            {children}
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5">
              {filterState.rules.map((rule) => {
                const fieldDef = fieldMap.get(rule.field);
                if (!fieldDef) return null;
                return (
                  <FilterPill
                    key={rule.id}
                    rule={rule}
                    fieldDef={fieldDef}
                    options={getOptionsForField(fieldDef)}
                    onRemove={() => removeRule(rule.id)}
                    onClick={() => setExpanded(true)}
                  />
                );
              })}

              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
              >
                Clear all
              </Button>

              {/* Expand/collapse toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-1.5 ml-auto"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded filter builder */}
      {expanded && hasActiveFilters && (
        <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-2">
          {/* Conjunction toggle */}
          {filterState.rules.length > 1 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Match</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={toggleConjunction}
              >
                {filterState.conjunction === "and" ? "ALL" : "ANY"}
              </Button>
              <span className="text-xs text-muted-foreground">of the following rules</span>
            </div>
          )}

          {/* Filter rows */}
          {filterState.rules.map((rule) => {
            const fieldDef = fieldMap.get(rule.field);
            if (!fieldDef) return null;
            return (
              <FilterRow
                key={rule.id}
                rule={rule}
                fieldDef={fieldDef}
                options={getOptionsForField(fieldDef)}
                allFields={fieldDefinitions}
                onChange={(updated) => updateRule(rule.id, updated)}
                onRemove={() => removeRule(rule.id)}
                onFieldChange={(newKey) => handleFieldChange(rule.id, newKey)}
              />
            );
          })}

          {/* Add another filter row */}
          <FieldPicker
            fields={fieldDefinitions}
            onSelect={addFilterRule}
            compact
          />
        </div>
      )}

      {/* Results count footer */}
      {isFiltered && (
        <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{filteredCount}</span>{" "}
            of{" "}
            <span className="font-medium text-foreground">{totalCount}</span>{" "}
            items
          </span>
        </div>
      )}
    </div>
  );
}
