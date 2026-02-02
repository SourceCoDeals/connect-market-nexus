import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
}

export function AnalyticsCard({ 
  tabs, 
  defaultTab, 
  rightAction,
  children, 
  className 
}: AnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border/50 overflow-hidden",
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
      <div className="p-5">
        {children(activeTab)}
      </div>
    </div>
  );
}

interface SortToggleProps {
  value: 'visitors' | 'connections';
  onChange: (value: 'visitors' | 'connections') => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <button
      onClick={() => onChange(value === 'visitors' ? 'connections' : 'visitors')}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
    >
      {value === 'visitors' ? 'Visitors' : 'Connections'}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}
