import { useState, useMemo } from "react";
import { X, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAnalyticsFilters, FilterType, AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";
import { cn } from "@/lib/utils";
import { ProportionalBar } from "./ProportionalBar";
import { ReferrerLogo, formatReferrerName } from "./ReferrerLogo";

interface FilterModalItem {
  id: string;
  label: string;
  visitors: number;
  signups?: number;
  connections?: number;
  icon?: string;
  extra?: string;
}

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  filterType: FilterType;
  items: FilterModalItem[];
  sortBy?: 'visitors' | 'signups' | 'connections';
}

export function FilterModal({ open, onClose, title, filterType, items, sortBy = 'visitors' }: FilterModalProps) {
  const [search, setSearch] = useState("");
  const { addFilter, hasFilter } = useAnalyticsFilters();

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter(item => 
      item.label.toLowerCase().includes(lower) ||
      item.id.toLowerCase().includes(lower)
    );
  }, [items, search]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (sortBy === 'signups') return (b.signups || 0) - (a.signups || 0);
      if (sortBy === 'connections') return (b.connections || 0) - (a.connections || 0);
      return b.visitors - a.visitors;
    });
  }, [filteredItems, sortBy]);

  const maxValue = useMemo(() => {
    if (sortBy === 'signups') return Math.max(...items.map(i => i.signups || 0), 1);
    if (sortBy === 'connections') return Math.max(...items.map(i => i.connections || 0), 1);
    return Math.max(...items.map(i => i.visitors), 1);
  }, [items, sortBy]);

  const handleFilter = (item: FilterModalItem) => {
    const filter: AnalyticsFilter = {
      type: filterType,
      value: item.id,
      label: item.label,
      icon: item.icon,
    };
    addFilter(filter);
    onClose();
  };

  const getValue = (item: FilterModalItem) => {
    if (sortBy === 'signups') return item.signups || 0;
    if (sortBy === 'connections') return item.connections || 0;
    return item.visitors;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium">{title}</DialogTitle>
          </div>
          
          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </DialogHeader>
        
        {/* Column headers */}
        <div className="flex items-center justify-between px-6 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
          <span>{title}</span>
          <div className="flex items-center gap-8">
            <span className="w-16 text-right">Visitors</span>
            <span className="w-16 text-right">Signups</span>
            <span className="w-16 text-right">Conv</span>
            <span className="w-8"></span>
          </div>
        </div>
        
        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="space-y-1">
            {sortedItems.map((item) => {
              const isActive = hasFilter(filterType, item.id);
              const value = getValue(item);
              
              return (
                <ProportionalBar
                  key={item.id}
                  value={value}
                  maxValue={maxValue}
                  secondaryValue={item.connections}
                  secondaryMaxValue={Math.max(...items.map(i => i.connections || 0), 1)}
                >
                  <div className={cn(
                    "flex items-center justify-between py-2 group cursor-pointer",
                    isActive && "opacity-50"
                  )}>
                    <div className="flex items-center gap-3 min-w-0">
                      {filterType === 'referrer' && (
                        <ReferrerLogo domain={item.id} className="w-5 h-5 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      {item.extra && (
                        <span className="text-xs text-muted-foreground">{item.extra}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <span className="text-sm tabular-nums w-16 text-right">
                        {item.visitors.toLocaleString()}
                      </span>
                      <span className="text-sm tabular-nums w-16 text-right text-muted-foreground">
                        {(item.signups || 0).toLocaleString()}
                      </span>
                      <span className={cn(
                        "text-sm tabular-nums w-16 text-right font-medium",
                        (item.connections || 0) > 0 ? "text-[hsl(12_95%_60%)]" : "text-muted-foreground"
                      )}>
                        {(item.connections || 0).toLocaleString()}
                      </span>
                      
                      {/* Filter button */}
                      <button
                        onClick={() => handleFilter(item)}
                        disabled={isActive}
                        className={cn(
                          "p-1.5 rounded-md transition-all",
                          "opacity-0 group-hover:opacity-100",
                          "hover:bg-muted",
                          isActive && "opacity-50 cursor-not-allowed"
                        )}
                        title={`Filter by ${item.label}`}
                      >
                        <Filter className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </ProportionalBar>
              );
            })}
            
            {sortedItems.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No results found
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/50 text-xs text-muted-foreground">
          {items.length} total items • Click the filter icon to filter dashboard
        </div>
      </DialogContent>
    </Dialog>
  );
}
