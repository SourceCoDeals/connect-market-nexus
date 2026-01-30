import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/exportUtils";

interface TopSearchQueriesProps {
  data: Array<{
    query: string;
    count: number;
    avgResults: number;
    clickRate: number;
  }>;
  className?: string;
}

export function TopSearchQueries({ data, className }: TopSearchQueriesProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const handleExport = () => {
    exportToCSV(data, 'search-queries', [
      { key: 'query', label: 'Search Query' },
      { key: 'count', label: 'Count' },
      { key: 'avgResults', label: 'Avg Results' },
      { key: 'clickRate', label: 'Click Rate %' },
    ]);
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Top Search Queries
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Most frequently searched terms
          </p>
        </div>
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Query
                </span>
              </th>
              <th className="text-right py-3 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Count
                </span>
              </th>
              <th className="text-right py-3 px-2 hidden sm:table-cell">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Avg Results
                </span>
              </th>
              <th className="text-right py-3 px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Click Rate
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((item, index) => (
              <tr 
                key={item.query}
                className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group"
              >
                <td className="py-3 px-2">
                  <div className="relative">
                    {/* Background bar */}
                    <div 
                      className="absolute inset-y-0 left-0 bg-coral-500/10 rounded group-hover:bg-coral-500/15 transition-colors"
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    />
                    <div className="relative flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/60 tabular-nums w-5">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        "{item.query}"
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="text-sm font-medium tabular-nums">
                    {item.count}
                  </span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {item.avgResults}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className={cn(
                    "text-sm font-medium tabular-nums",
                    item.clickRate >= 50 ? "text-green-500" : 
                    item.clickRate >= 25 ? "text-peach-500" : "text-muted-foreground"
                  )}>
                    {item.clickRate.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No search data available
          </p>
        )}
      </div>
    </div>
  );
}
