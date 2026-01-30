import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopListingsCardProps {
  listings: Array<{
    id: string;
    title: string;
    connectionCount: number;
    category: string;
  }>;
}

export function TopListingsCard({ listings }: TopListingsCardProps) {
  const maxConnections = Math.max(...listings.map(l => l.connectionCount), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg font-semibold">Top Performing Listings</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Most requested deals this period
        </p>
      </CardHeader>
      <CardContent>
        {listings.length > 0 ? (
          <div className="space-y-3 mt-2">
            {listings.map((listing, index) => {
              const barWidth = (listing.connectionCount / maxConnections) * 100;
              
              return (
                <div 
                  key={listing.id}
                  className="group relative p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all"
                >
                  {/* Rank badge */}
                  <div className={cn(
                    "absolute -left-2 -top-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
                    index === 0 && "bg-amber-500 text-white",
                    index === 1 && "bg-gray-300 text-gray-700",
                    index === 2 && "bg-amber-700 text-white",
                    index > 2 && "bg-muted text-muted-foreground",
                  )}>
                    {index + 1}
                  </div>

                  <div className="flex items-start justify-between gap-3 pl-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {listing.title}
                      </p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {listing.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <TrendingUp className="h-3.5 w-3.5 text-success" />
                      <span className="text-lg font-bold tabular-nums">
                        {listing.connectionCount}
                      </span>
                    </div>
                  </div>

                  {/* Background bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted rounded-b-lg overflow-hidden">
                    <div 
                      className="h-full bg-primary/30 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No listing data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
