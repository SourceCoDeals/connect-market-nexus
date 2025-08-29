import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { Deal } from '@/hooks/admin/use-deals';
import { useDeals } from '@/hooks/admin/use-deals';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface PipelineTableViewProps {
  filters: PipelineFilters;
  onDealClick: (deal: Deal) => void;
  selectedDeal: Deal | null;
}

export const PipelineTableView: React.FC<PipelineTableViewProps> = ({
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
    <div className="h-full overflow-auto">
      <div className="min-w-full">
        {/* Table Header */}
        <div className="bg-muted/50 border-b border-border/50 sticky top-0 z-10">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-muted-foreground">
            <div className="col-span-3 flex items-center gap-2">
              Deal Title
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2">Stage</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2">Value</div>
            <div className="col-span-1">Probability</div>
            <div className="col-span-1">Created</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border/50">
          {filteredDeals.map(deal => (
            <div
              key={deal.deal_id}
              className={cn(
                "grid grid-cols-12 gap-4 px-6 py-4 text-sm hover:bg-muted/20 cursor-pointer transition-colors",
                selectedDeal?.deal_id === deal.deal_id && "bg-primary/5 border-l-2 border-l-primary"
              )}
              onClick={() => onDealClick(deal)}
            >
              <div className="col-span-3">
                <div className="font-medium truncate">{deal.deal_title}</div>
                {deal.listing_id && (
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {deal.listing_title}
                  </div>
                )}
              </div>
              
              <div className="col-span-2">
                <div className="font-medium">{deal.contact_name || deal.buyer_name}</div>
                {(deal.contact_company || deal.buyer_company) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {deal.contact_company || deal.buyer_company}
                  </div>
                )}
              </div>
              
              <div className="col-span-2">
                <Badge variant="secondary" className="text-xs">
                  {deal.stage_name}
                </Badge>
              </div>
              
              <div className="col-span-1">
                <Badge variant="outline" className={cn("text-xs", getPriorityColor(deal.deal_priority))}>
                  {deal.deal_priority}
                </Badge>
              </div>
              
              <div className="col-span-2 font-medium">
                {formatCurrency(deal.deal_value || 0)}
              </div>
              
              <div className="col-span-1 text-center">
                {deal.deal_probability || 0}%
              </div>
              
              <div className="col-span-1 text-muted-foreground">
                {new Date(deal.deal_created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {filteredDeals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No deals found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};