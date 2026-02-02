import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, List } from "lucide-react";

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
}

export function AnalyticsCard({ 
  tabs, 
  defaultTab, 
  rightAction,
  children, 
  className,
  onDetailsClick
}: AnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

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
      
      {/* Details footer */}
      {onDetailsClick && (
        <div className="px-5 pb-4 pt-0">
          <button
            onClick={() => onDetailsClick(activeTab)}
            className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors border border-border/30"
          >
            <List className="h-3.5 w-3.5" />
            Details
          </button>
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
