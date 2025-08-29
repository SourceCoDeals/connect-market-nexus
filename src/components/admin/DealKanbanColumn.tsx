import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Deal, DealStage } from '@/hooks/admin/use-deals';
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';

interface DealKanbanColumnProps {
  stage: DealStage & {
    dealCount: number;
    totalValue: number;
    avgProbability: number;
  };
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

export function DealKanbanColumn({ stage, deals, onDealClick }: DealKanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-72">
      <Card className="h-full flex flex-col border-border/30 bg-background/40 backdrop-blur-sm">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              <span>{stage.name}</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground font-medium">
              {stage.dealCount}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 flex-1 overflow-hidden px-3 pb-3">
          <div
            ref={setNodeRef}
            className="h-full overflow-y-auto space-y-2 pr-1"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          >
            <SortableContext 
              items={deals.map(deal => deal.deal_id)}
              strategy={verticalListSortingStrategy}
            >
              {deals.map((deal) => (
                <EnhancedDealKanbanCard
                  key={deal.deal_id}
                  deal={deal}
                  onClick={() => onDealClick?.(deal)}
                />
              ))}
            </SortableContext>
            
            {deals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground/60 text-xs">
                <div>No deals</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}