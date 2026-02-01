import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, ArrowUpRight, Mail, Search, Link2, MousePointerClick } from "lucide-react";

interface AttributionTableProps {
  sources: { source: string; count: number }[];
  isLoading: boolean;
}

const sourceIcons: Record<string, React.ReactNode> = {
  google: <Search className="h-3.5 w-3.5" />,
  bing: <Search className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  newsletter: <Mail className="h-3.5 w-3.5" />,
  linkedin: <Link2 className="h-3.5 w-3.5" />,
  facebook: <Globe className="h-3.5 w-3.5" />,
  twitter: <Globe className="h-3.5 w-3.5" />,
  referral: <ArrowUpRight className="h-3.5 w-3.5" />,
  direct: <MousePointerClick className="h-3.5 w-3.5" />,
};

export function AttributionTable({ sources, isLoading }: AttributionTableProps) {
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0);

  const getIcon = (source: string) => {
    const lowerSource = source.toLowerCase();
    for (const [key, icon] of Object.entries(sourceIcons)) {
      if (lowerSource.includes(key)) return icon;
    }
    return <Globe className="h-3.5 w-3.5" />;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Top Traffic Sources</CardTitle>
        <p className="text-xs text-muted-foreground">
          First-touch attribution by source
        </p>
      </CardHeader>
      <CardContent>
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
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  {/* Rank */}
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    {index + 1}
                  </span>
                  
                  {/* Icon */}
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {getIcon(item.source)}
                  </div>
                  
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
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary/70 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Count */}
                  <span className="text-sm font-semibold tabular-nums w-8 text-right">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
