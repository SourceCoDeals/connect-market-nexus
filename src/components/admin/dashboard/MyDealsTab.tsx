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
            icon: <Briefcase className="h-5 w-5" />,
            description: 'Currently in pipeline',
          },
          {
            label: 'Need Attention',
            value: stats.needAttention,
            icon: <Target className="h-5 w-5" />,
            description: 'Require follow-up or stale',
          },
          {
            label: 'This Week',
            value: stats.thisWeek,
            icon: <Clock className="h-5 w-5" />,
            description: 'New or updated recently',
          },
          {
            label: 'Stale Deals',
            value: stats.staleDeals,
            icon: <Clock className="h-5 w-5" />,
            description: '7+ days in same stage',
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm border-border/50">
              <Filter className="h-3.5 w-3.5 mr-2" />
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
        <div className="text-center py-16 px-4 border border-dashed border-border/50 rounded-lg bg-muted/20">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="text-lg font-medium mb-2 text-foreground">
            {filter === 'active' && deals && deals.length > 0 
              ? '🎉 All caught up!' 
              : 'No deals found'
            }
          </h3>
          <p className="text-sm text-muted-foreground/70 max-w-md mx-auto mb-6">
            {filter === 'active' && deals && deals.length > 0
              ? "No active deals need your attention right now. Great work!"
              : filter === 'all' && (!deals || deals.length === 0)
              ? "No deals assigned yet. Deals from the pipeline will appear here."
              : `No ${filter === 'closed' ? 'closed' : filter.replace('-', ' ')} deals found. Try a different filter.`
            }
          </p>
          {(!deals || deals.length === 0) && (
            <Button onClick={() => navigate('/admin/pipeline')}>
              <Plus className="h-4 w-4 mr-2" />
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
