import { Skeleton } from "@/components/ui/skeleton";

interface AttributionTableProps {
  sources: { source: string; count: number }[];
  isLoading: boolean;
}

export function AttributionTable({ sources, isLoading }: AttributionTableProps) {
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Top Traffic Sources
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          First-touch attribution by source
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No attribution data yet
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((item, index) => {
            const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
            
            return (
              <div 
                key={item.source}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                {/* Rank */}
                <span className="text-xs font-medium text-muted-foreground w-4 tabular-nums">
                  {index + 1}
                </span>
                
                {/* Source name and bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize truncate">
                      {item.source}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                
                {/* Count */}
                <span className="text-sm font-semibold tabular-nums w-10 text-right">
                  {item.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
