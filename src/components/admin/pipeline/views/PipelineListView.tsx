import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { Deal } from '@/hooks/admin/use-deals';
import { useDeals } from '@/hooks/admin/use-deals';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PipelineListViewProps {
  filters: PipelineFilters;
  onDealClick: (deal: Deal) => void;
  selectedDeal: Deal | null;
}

export const PipelineListView: React.FC<PipelineListViewProps> = ({
  filters,
  onDealClick,
  selectedDeal
}) => {
  const { data: deals = [], isLoading } = useDeals();

  // Filter deals based on current filters
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Search filter
      if (filters.search && !deal.deal_title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Stage filter
      if (filters.stage !== 'all' && deal.stage_name?.toLowerCase() !== filters.stage) {
        return false;
      }

      // Priority filter
      if (filters.priority !== 'all' && deal.deal_priority !== filters.priority) {
        return false;
      }

      // Deal value filter
      const dealValue = deal.deal_value || 0;
      if (dealValue < filters.dealValue[0] || dealValue > filters.dealValue[1]) {
        return false;
      }

      return true;
    });
  }, [deals, filters]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-info text-info-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="space-y-3 max-w-4xl">
        {filteredDeals.map(deal => (
          <Card
            key={deal.deal_id}
            className={cn(
              "p-4 cursor-pointer transition-all duration-200 hover:shadow-md border-border/50",
              selectedDeal?.deal_id === deal.deal_id && "ring-2 ring-primary border-primary/50"
            )}
            onClick={() => onDealClick(deal)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold truncate">{deal.deal_title}</h3>
                  <Badge variant="outline" className={cn("text-xs", getPriorityColor(deal.deal_priority))}>
                    {deal.deal_priority}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {deal.stage_name}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{deal.contact_name || deal.buyer_name}</span>
                  {(deal.contact_company || deal.buyer_company) && <span>• {deal.contact_company || deal.buyer_company}</span>}
                  <span>• {formatCurrency(deal.deal_value || 0)}</span>
                  <span>• {deal.deal_probability || 0}% probability</span>
                </div>
              </div>

              <div className="text-right text-sm text-muted-foreground ml-4">
                <div>{new Date(deal.deal_created_at).toLocaleDateString()}</div>
                {deal.next_followup_due && (
                  <div className="text-xs">
                    Follow-up: {new Date(deal.next_followup_due).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        {filteredDeals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No deals found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};