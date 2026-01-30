import { cn } from "@/lib/utils";

interface ZeroResultsAlertProps {
  data: Array<{
    query: string;
    count: number;
  }>;
  className?: string;
}

export function ZeroResultsAlert({ data, className }: ZeroResultsAlertProps) {
  const hasIssues = data.length > 0;

  return (
    <div className={cn(
      "rounded-2xl border p-6",
      hasIssues 
        ? "bg-coral-500/5 border-coral-500/30" 
        : "bg-card border-border/50",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Zero Result Searches
          </p>
          {hasIssues && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-coral-500/20 text-coral-600 rounded-full">
              {data.length} gaps
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Searches that found no listings — opportunity gaps
        </p>
      </div>

      {/* Content */}
      {hasIssues ? (
        <div className="space-y-2">
          {data.slice(0, 8).map((item) => (
            <div 
              key={item.query}
              className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30"
            >
              <span className="text-sm text-foreground font-medium">
                "{item.query}"
              </span>
              <span className="text-xs text-coral-500 font-medium tabular-nums">
                {item.count}× searched
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">All searches found results</p>
          <p className="text-xs text-muted-foreground/60 mt-1">No opportunity gaps detected</p>
        </div>
      )}

      {/* Insight */}
      {hasIssues && (
        <div className="mt-4 pt-4 border-t border-coral-500/20">
          <p className="text-xs text-muted-foreground">
            Consider adding listings in these categories or expanding search synonyms.
          </p>
        </div>
      )}
    </div>
  );
}
