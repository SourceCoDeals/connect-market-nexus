import { cn } from "@/lib/utils";

interface JourneyPath {
  source: string;
  target: string;
  count: number;
}

interface UserJourneyFlowProps {
  data: JourneyPath[];
  className?: string;
}

export function UserJourneyFlow({ data, className }: UserJourneyFlowProps) {
  // Get unique sources and targets
  const sources = [...new Set(data.map(d => d.source))];
  const targets = [...new Set(data.map(d => d.target))];
  
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const totalFlows = data.reduce((sum, d) => sum + d.count, 0);

  // Color mapping for sources
  const sourceColors: Record<string, string> = {
    'Home': 'bg-coral-500',
    'Search': 'bg-peach-400',
    'Category': 'bg-blue-500',
    'Direct': 'bg-emerald-500',
    'External': 'bg-purple-500',
  };

  const getSourceColor = (source: string) => {
    for (const [key, color] of Object.entries(sourceColors)) {
      if (source.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return 'bg-muted-foreground';
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          User Journey Paths
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          How users navigate to listings
        </p>
      </div>

      {/* Journey Flow Visualization */}
      <div className="space-y-3">
        {data.slice(0, 10).map((path, index) => {
          const width = (path.count / maxCount) * 100;
          const percentage = ((path.count / totalFlows) * 100).toFixed(1);
          
          return (
            <div key={`${path.source}-${path.target}-${index}`} className="group">
              <div className="flex items-center gap-3 mb-1">
                {/* Source */}
                <div className="flex items-center gap-2 min-w-[100px]">
                  <div className={cn("w-2 h-2 rounded-full", getSourceColor(path.source))} />
                  <span className="text-xs text-muted-foreground truncate">
                    {path.source}
                  </span>
                </div>
                
                {/* Arrow */}
                <span className="text-muted-foreground/50">→</span>
                
                {/* Target */}
                <span className="text-xs font-medium text-foreground truncate min-w-[80px]">
                  {path.target}
                </span>
                
                {/* Count */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {path.count.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                    {percentage}%
                  </span>
                </div>
              </div>
              
              {/* Flow bar */}
              <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    getSourceColor(path.source)
                  )}
                  style={{ 
                    width: `${width}%`,
                    opacity: 0.7 + (path.count / maxCount) * 0.3
                  }}
                />
              </div>
            </div>
          );
        })}

        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No journey data available
          </p>
        )}
      </div>

      {/* Legend */}
      {data.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/30">
          <div className="flex flex-wrap gap-3">
            {sources.slice(0, 5).map(source => (
              <div key={source} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", getSourceColor(source))} />
                <span className="text-[10px] text-muted-foreground">{source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
