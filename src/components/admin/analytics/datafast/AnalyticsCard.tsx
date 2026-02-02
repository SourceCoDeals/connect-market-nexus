import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Globe, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Tab {
  id: string;
  label: string;
}

interface AnalyticsCardProps {
  tabs: Tab[];
  defaultTab?: string;
  rightAction?: ReactNode;
  children: (activeTab: string) => ReactNode;
  className?: string;
  onDetailsClick?: (activeTab: string) => void;
  onGlobeClick?: () => void;
}

export function AnalyticsCard({ 
  tabs, 
  defaultTab, 
  rightAction,
  children, 
  className,
  onDetailsClick,
  onGlobeClick
}: AnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const hasFooter = onDetailsClick || onGlobeClick;

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col",
      className
    )}>
      {/* Tab Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-1">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                activeTab === tab.id
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {rightAction && (
          <div className="flex items-center">
            {rightAction}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5 flex-1">
        {children(activeTab)}
      </div>
      
      {/* Footer with icon buttons - datafast style */}
      {hasFooter && (
        <div className="flex items-center justify-center gap-2 px-5 pb-4 pt-0">
          <TooltipProvider delayDuration={200}>
            {onGlobeClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onGlobeClick}
                    className="p-2.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  View on globe
                </TooltipContent>
              </Tooltip>
            )}
            {onDetailsClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDetailsClick(activeTab)}
                    className="p-2.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Lightbulb className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  View details & filter
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

export type SortValue = 'visitors' | 'signups' | 'connections';

interface SortToggleProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  const cycle = () => {
    if (value === 'visitors') onChange('signups');
    else if (value === 'signups') onChange('connections');
    else onChange('visitors');
  };

  const labels: Record<SortValue, string> = {
    visitors: 'Visitors',
    signups: 'Signups',
    connections: 'Connections',
  };

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
    >
      {labels[value]}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}
