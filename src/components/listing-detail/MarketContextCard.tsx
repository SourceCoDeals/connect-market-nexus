import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarketContext } from '@/hooks/use-market-context';

interface MarketContextCardProps {
  listingId: string;
  category: string;
  revenue: number;
  ebitda: number;
}

export function MarketContextCard({ listingId, category, revenue, ebitda }: MarketContextCardProps) {
  const { data: marketContext, isLoading } = useMarketContext(listingId, category, revenue, ebitda);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">Market context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!marketContext) return null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base font-medium">Market context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Similar deals (90d)</span>
          <span className="font-medium">{marketContext.similarDealsCount}</span>
        </div>
        {marketContext.medianEbitdaMultiple !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Median EBITDA multiple</span>
            <span className="font-medium">{marketContext.medianEbitdaMultiple.toFixed(1)}x</span>
          </div>
        )}
        {marketContext.avgTimeToClose !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg time to close</span>
            <span className="font-medium">{marketContext.avgTimeToClose} days</span>
          </div>
        )}
        {marketContext.similarDealsCount === 0 && (
          <p className="text-xs text-muted-foreground">
            No similar deals found in the last 90 days
          </p>
        )}
      </CardContent>
    </Card>
  );
}
