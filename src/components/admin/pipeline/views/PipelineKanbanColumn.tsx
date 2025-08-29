import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PipelineKanbanCard } from './PipelineKanbanCard';
import { Deal, DealStage } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

interface PipelineKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  selectedDeal: Deal | null;
}

export const PipelineKanbanColumn: React.FC<PipelineKanbanColumnProps> = ({
  stage,
  deals,
  onDealClick,
  selectedDeal
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-80 flex-shrink-0">
      {/* Column Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">{stage.name}</h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{deals.length} deals</span>
          <span>{formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-96 rounded-lg border-2 border-dashed transition-colors p-2",
          isOver ? "border-primary bg-primary/5" : "border-border/50 bg-muted/20"
        )}
      >
        <div className="space-y-3">
          {deals.map(deal => (
            <PipelineKanbanCard
              key={deal.deal_id}
              deal={deal}
              onClick={() => onDealClick(deal)}
              isSelected={selectedDeal?.deal_id === deal.deal_id}
            />
          ))}
          
          {deals.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No deals in this stage
            </div>
          )}
        </div>
      </div>
    </div>
  );
};