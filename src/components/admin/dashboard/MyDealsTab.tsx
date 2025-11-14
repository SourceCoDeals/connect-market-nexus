import { useMyDeals, useMyDealStats } from '@/hooks/admin/use-my-deals';
import { StripeStatsSection } from '@/components/admin/analytics/StripeStatsSection';
import { EnhancedDealCard } from './EnhancedDealCard';
import { DealPriorityBanner } from './DealPriorityBanner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
// No icon imports needed
import { formatCompactCurrency } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export function MyDealsTab() {
  const { data: deals, isLoading: dealsLoading } = useMyDeals();
  const { data: stats, isLoading: statsLoading } = useMyDealStats();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('recent');

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    if (!deals) return [];
    
    let filtered = [...deals];
    const terminalStages = ['Closed Won', 'Closed Lost'];
    
    // Apply filters
    switch (filter) {
      case 'active':
        // Show only non-closed deals
        filtered = filtered.filter(d => {
          const isTerminal = d.stage && terminalStages.includes(d.stage.name);
          return !isTerminal;
        });
        break;
      case 'needs-follow-up':
        filtered = filtered.filter(d => {
          const isTerminal = d.stage && terminalStages.includes(d.stage.name);
          return !isTerminal && !d.followed_up;
        });
        break;
      case 'stale':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(d => {
          const isTerminal = d.stage && terminalStages.includes(d.stage.name);
          return !isTerminal && new Date(d.stage_entered_at) < weekAgo;
        });
        break;
      case 'closed':
        // Show only closed deals
        filtered = filtered.filter(d => 
          d.stage && terminalStages.includes(d.stage.name)
        );
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
        const weekAgoUrgency = new Date();
        weekAgoUrgency.setDate(weekAgoUrgency.getDate() - 7);
        filtered.sort((a, b) => {
          const aIsTerminal = a.stage && terminalStages.includes(a.stage.name);
          const bIsTerminal = b.stage && terminalStages.includes(b.stage.name);
          const aStale = !aIsTerminal && new Date(a.stage_entered_at) < weekAgoUrgency ? 1 : 0;
          const bStale = !bIsTerminal && new Date(b.stage_entered_at) < weekAgoUrgency ? 1 : 0;
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

  return (
    <div className="space-y-6">
      {/* Stats Section */}
      <StripeStatsSection
        stats={[
          {
            label: 'Active Deals',
            value: stats.activeDeals,
            description: 'Currently in pipeline',
            onClick: () => setFilter('active'),
            isActive: filter === 'active',
          },
          {
            label: 'Need Attention',
            value: stats.needAttention,
            description: 'Require follow-up',
            onClick: () => setFilter('needs-follow-up'),
            isActive: filter === 'needs-follow-up',
          },
          {
            label: 'This Week',
            value: stats.thisWeek,
            description: 'Created or updated',
          },
          {
            label: 'Stale Deals',
            value: stats.staleDeals,
            description: '7+ days in stage',
            onClick: () => setFilter('stale'),
            isActive: filter === 'stale',
          },
        ]}
      />

      {/* Priority Banner - Only show if there are active deals needing attention */}
      {stats.needAttention > 0 && filter !== 'closed' && (
        <DealPriorityBanner 
          staleDeals={stats.staleDeals} 
          needsFollowUp={stats.needsFollowUp} 
        />
      )}

      {/* Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="needs-follow-up">Needs Follow-up</SelectItem>
              <SelectItem value="stale">Stale (7+ days)</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All Deals</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
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
          className="h-9 bg-foreground text-background hover:bg-foreground/90"
        >
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
        <div className="text-center py-16 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900">
          <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800" />
          <h3 className="text-lg font-medium mb-2 text-slate-900 dark:text-slate-100">
            {filter === 'active' && deals && deals.length > 0 
              ? 'All caught up' 
              : 'No deals found'
            }
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            {filter === 'active' && deals && deals.length > 0
              ? "No active deals need your attention right now. Great work!"
              : filter === 'all' && (!deals || deals.length === 0)
              ? "No deals assigned yet. Deals from the pipeline will appear here."
              : `No ${filter === 'closed' ? 'closed' : filter.replace('-', ' ')} deals found. Try a different filter.`
            }
          </p>
          {(!deals || deals.length === 0) && (
            <Button 
              onClick={() => navigate('/admin/pipeline')}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              View Pipeline
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
