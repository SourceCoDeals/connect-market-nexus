import { useMyDeals, useMyDealStats } from '@/hooks/admin/use-my-deals';
import { StripeStatsSection } from '@/components/admin/analytics/StripeStatsSection';
import { EnhancedDealCard } from './EnhancedDealCard';
import { DealPriorityBanner } from './DealPriorityBanner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, DollarSign, Target, Clock, Plus, Filter, ArrowUpDown } from 'lucide-react';
import { formatCompactCurrency } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export function MyDealsTab() {
  const { data: deals, isLoading: dealsLoading } = useMyDeals();
  const { data: stats, isLoading: statsLoading } = useMyDealStats();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  // Calculate win rate and average deal age
  const enhancedStats = useMemo(() => {
    if (!stats || !deals) return null;
    
    // Win rate calculation (placeholder - would need "won" deals data)
    const winRate = stats.totalDeals > 0 ? 0 : 0; // TODO: Calculate from actual won deals
    
    // Average deal age
    const now = new Date();
    const avgAge = deals.length > 0 
      ? Math.round(deals.reduce((sum, deal) => {
          const createdAt = new Date(deal.created_at);
          const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          return sum + ageInDays;
        }, 0) / deals.length)
      : 0;
    
    return {
      ...stats,
      winRate,
      avgAge,
    };
  }, [stats, deals]);

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    if (!deals) return [];
    
    let filtered = [...deals];
    
    // Apply filters
    switch (filter) {
      case 'active':
        filtered = filtered.filter(d => !d.followed_up);
        break;
      case 'needs-follow-up':
        filtered = filtered.filter(d => !d.followed_up);
        break;
      case 'stale':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(d => new Date(d.stage_entered_at) < weekAgo);
        break;
      case 'high-value':
        const avgValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0) / deals.length;
        filtered = filtered.filter(d => (Number(d.value) || 0) > avgValue);
        break;
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'value':
        filtered.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
        break;
      case 'urgency':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered.sort((a, b) => {
          const aStale = new Date(a.stage_entered_at) < weekAgo ? 1 : 0;
          const bStale = new Date(b.stage_entered_at) < weekAgo ? 1 : 0;
          const aFollowUp = !a.followed_up ? 1 : 0;
          const bFollowUp = !b.followed_up ? 1 : 0;
          return (bStale + bFollowUp) - (aStale + aFollowUp);
        });
        break;
    }
    
    return filtered;
  }, [deals, filter, sortBy]);

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const statsData = [
    {
      label: "Total Deals",
      value: `${enhancedStats?.totalDeals || 0}`,
      icon: <Briefcase className="h-5 w-5" />,
      description: "Active in pipeline",
      trend: {
        value: 0,
        isPositive: true,
        label: "vs last month",
      },
    },
    {
      label: "Total Value",
      value: formatCompactCurrency(enhancedStats?.totalValue || 0),
      icon: <DollarSign className="h-5 w-5" />,
      description: "Potential revenue",
      trend: {
        value: 0,
        isPositive: true,
        label: "vs last month",
      },
    },
    {
      label: "Win Rate",
      value: `${enhancedStats?.winRate || 0}%`,
      icon: <Target className="h-5 w-5" />,
      description: "Success rate",
    },
    {
      label: "Avg. Deal Age",
      value: `${enhancedStats?.avgAge || 0}d`,
      icon: <Clock className="h-5 w-5" />,
      description: "Days in pipeline",
      trend: {
        value: 0,
        isPositive: false,
        label: "vs last month",
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <StripeStatsSection stats={statsData} />

      {/* Priority Alert Banner */}
      {enhancedStats && (enhancedStats.staleDeals > 0 || enhancedStats.needsFollowUp > 0) && (
        <DealPriorityBanner 
          staleDeals={enhancedStats.staleDeals}
          needsFollowUp={enhancedStats.needsFollowUp}
        />
      )}

      {/* Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm border-border/50">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deals</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="needs-follow-up">Needs Follow-up</SelectItem>
              <SelectItem value="stale">Stale (7+ days)</SelectItem>
              <SelectItem value="high-value">High Value</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] h-9 text-sm border-border/50">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="value">Highest Value</SelectItem>
              <SelectItem value="urgency">Most Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          size="sm"
          onClick={() => navigate('/admin/pipeline')}
          className="h-9"
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          Create Deal
        </Button>
      </div>

      {/* Deal Cards Grid */}
      {dealsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filteredAndSortedDeals.length === 0 ? (
        <div className="text-center py-16 border border-border/50 rounded-lg bg-muted/20">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {filter === 'all' ? 'No deals assigned yet' : 'No deals match this filter'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {filter === 'all' 
              ? 'Create your first deal to get started.' 
              : 'Try a different filter to see more deals.'}
          </p>
          {filter === 'all' && (
            <Button onClick={() => navigate('/admin/pipeline')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAndSortedDeals.map((deal) => (
            <EnhancedDealCard 
              key={deal.id} 
              deal={deal}
              onDealClick={(dealId) => navigate(`/admin/pipeline?deal=${dealId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
