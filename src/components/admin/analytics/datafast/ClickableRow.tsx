import { ReactNode } from "react";
import { Filter } from "lucide-react";
import { useAnalyticsFilters, FilterType, AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClickableRowProps {
  children: ReactNode;
  filter: AnalyticsFilter;
  className?: string;
}

export function ClickableRow({ children, filter, className }: ClickableRowProps) {
  const { addFilter, hasFilter } = useAnalyticsFilters();
  
  const isActive = hasFilter(filter.type, filter.value);

  const handleClick = () => {
    if (!isActive) {
      addFilter(filter);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleClick}
            className={cn(
              "relative group cursor-pointer transition-all",
              isActive && "opacity-60",
              className
            )}
          >
            {children}
            
            {/* Filter indicator on hover */}
            {!isActive && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 rounded-md bg-muted/80">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {isActive ? `Filtered by ${filter.label}` : `Filter by ${filter.label}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
