import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyerTypeBreakdownProps {
  data: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

const typeColors: Record<string, string> = {
  'Private Equity': 'bg-violet-500',
  'Individual': 'bg-blue-500',
  'Independent Sponsor': 'bg-emerald-500',
  'Search Fund': 'bg-amber-500',
  'Family Office': 'bg-rose-500',
  'Corporate': 'bg-cyan-500',
  'Strategic': 'bg-orange-500',
};

export function BuyerTypeBreakdown({ data }: BuyerTypeBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-500" />
          <CardTitle className="text-lg font-semibold">Buyer Composition</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} approved buyers by type
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mt-4">
          {data.slice(0, 6).map((item, index) => {
            const color = typeColors[item.type] || 'bg-gray-500';
            const widthPercentage = (item.count / maxCount) * 100;
            
            return (
              <div key={item.type} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                    <span className="text-sm font-medium">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                      color
                    )}
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend dots at bottom */}
        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-border/50">
          {data.slice(0, 6).map((item) => {
            const color = typeColors[item.type] || 'bg-gray-500';
            return (
              <div key={item.type} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-xs text-muted-foreground">{item.type}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
