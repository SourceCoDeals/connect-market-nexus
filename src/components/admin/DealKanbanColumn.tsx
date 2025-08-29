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
    <div className="flex-shrink-0 w-80">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              {stage.name}
            </CardTitle>
            <Badge variant="outline">{stage.dealCount}</Badge>
          </div>
          
          {stage.dealCount > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-medium">{formatCurrency(stage.totalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Probability:</span>
                <span className="font-medium">{Math.round(stage.avgProbability)}%</span>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="pt-0 flex-1 overflow-hidden">
          <div
            ref={setNodeRef}
            className="h-full overflow-y-auto space-y-3 pr-1"
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
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No deals in this stage
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}