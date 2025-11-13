
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { PipelineKanbanCard } from './PipelineKanbanCard';

interface StageWithMetrics {
  id: string;
  name: string;
  color: string;
  position: number;
  dealCount: number;
  totalValue: number;
  avgProbability: number;
  deals: Deal[];
}

interface PipelineKanbanColumnProps {
  stage: StageWithMetrics;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onOpenCreateDeal?: (stageId: string) => void;
  totalStages?: number;
}

export function PipelineKanbanColumn({ stage, deals, onDealClick, onOpenCreateDeal, totalStages = 12 }: PipelineKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
  });
  
  const sortableItems = deals.map(d => `deal:${d.deal_id}`);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 1000000 ? 'compact' : 'standard',
    }).format(value);
  };

  // Dynamic progression calculation based on active stages
  const isClosedWon = stage.name.toLowerCase().includes('closed') && stage.name.toLowerCase().includes('won');
  const isClosedLost = stage.name.toLowerCase().includes('closed') && stage.name.toLowerCase().includes('lost');
  
  // Calculate max progress stage dynamically (all stages except Closed Lost)
  const activeProgressStages = totalStages - 1; // Exclude Closed Lost from count
  const maxProgressStage = activeProgressStages;
  
  // For Closed Won, show 100% completion
  // For other stages, calculate based on position in the active stages
  const stageNumber = stage.position + 1;
  const progressPercentage = isClosedWon ? 100 : Math.min((stageNumber / maxProgressStage) * 100, 100);
  
  return (
    <div className="flex-shrink-0 w-[280px]">
      <Card 
        ref={setNodeRef}
        className={`h-full flex flex-col transition-colors duration-200 ${
          isOver ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-card/50'
        }`}
      >
        {/* Column Header - Minimal */}
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-semibold text-sm text-foreground truncate">
                {stage.name}
              </h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
                {stage.dealCount}
              </Badge>
            </div>
          </div>

          {/* Stage Progression Bar */}
          {!isClosedLost && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-medium">
                  Stage {isClosedWon ? maxProgressStage : stageNumber} of {maxProgressStage}
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        
        {/* Deals List */}
        <CardContent className="flex-1 overflow-y-auto px-2 space-y-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            {deals.length > 0 ? (
              deals.map((deal) => (
                <PipelineKanbanCard
                  key={deal.deal_id}
                  deal={deal}
                  onDealClick={onDealClick}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <div className="text-sm opacity-75">No deals</div>
                <div className="text-xs mt-1 opacity-50">Drag deals here</div>
              </div>
            )}
            
            {/* Add Deal Button */}
            <Button
              variant="ghost"
              className="w-full h-10 border-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              onClick={() => onOpenCreateDeal?.(stage.id)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}
