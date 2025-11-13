import { useMyDeals, useMyDealStats } from '@/hooks/admin/use-my-deals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '@/lib/currency-utils';

export function MyDealsWidget() {
  const { data: deals, isLoading: dealsLoading } = useMyDeals();
  const { data: stats, isLoading: statsLoading } = useMyDealStats();
  const navigate = useNavigate();

  if (dealsLoading || statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Deals</CardTitle>
          <CardDescription>Loading your deals...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>My Deals</CardTitle>
            <CardDescription>Deals assigned to you</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/pipeline')}
          >
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Total Deals
            </div>
            <p className="text-2xl font-bold">{stats?.totalDeals || 0}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total Value
            </div>
            <p className="text-2xl font-bold">
              ${formatNumber(stats?.totalValue || 0)}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Needs Follow-up
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {stats?.needsFollowUp || 0}
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Stale (7+ days)
            </div>
            <p className="text-2xl font-bold text-red-600">
              {stats?.staleDeals || 0}
            </p>
          </div>
        </div>

        {/* Recent Deals */}
        {deals && deals.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="space-y-2">
              {deals.slice(0, 3).map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/admin/pipeline?deal=${deal.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{deal.title || 'Untitled Deal'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {deal.stage?.name || 'Unknown Stage'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ${formatNumber(Number(deal.value) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
