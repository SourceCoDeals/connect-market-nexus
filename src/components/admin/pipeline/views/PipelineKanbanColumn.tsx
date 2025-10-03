
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

  // Calculate stage progression
  // - Closed Won (position 10) = 100% complete = stage 10/10
  // - Closed Lost (position 11) = no progression shown
  // - All other stages count toward 10 total active stages
  const isClosedWon = stage.name.toLowerCase().includes('closed') && stage.name.toLowerCase().includes('won');
  const isClosedLost = stage.name.toLowerCase().includes('closed') && stage.name.toLowerCase().includes('lost');
  
  const stageNumber = stage.position + 1;
  const maxProgressStage = 10; // Up to "Closed Won" which is position 9 (stage 10)
  const progressPercentage = isClosedWon ? 100 : (stageNumber / maxProgressStage) * 100;
  
  return (
    <Card 
      ref={setNodeRef}
      className={`h-full flex flex-col transition-colors duration-200 ${
        isOver ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-card/50'
      }`}
    >
      {/* Column Header */}
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-sm text-foreground truncate">
              {stage.name}
            </h3>
            <Badge variant="secondary" className="h-5 px-2 text-xs flex-shrink-0">
              {stage.dealCount}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
            <MoreVertical className="h-3 w-3" />
          </Button>
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
      <CardContent 
        className="flex-1 p-3 pt-0 overflow-y-auto"
      >
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-full">
            {deals.map((deal) => {
              console.log('[Pipeline Column] Rendering card for deal:', {
                deal_id: deal.deal_id,
                deal_title: deal.deal_title,
                contact_name: deal.contact_name,
                has_deal_id: 'deal_id' in deal,
                keys: Object.keys(deal).slice(0, 10)
              });
              return (
                <PipelineKanbanCard 
                  key={deal.deal_id}
                  deal={deal}
                  onDealClick={onDealClick}
                />
              );
            })}
          
          {/* Add Deal Button */}
          <Button
            variant="ghost"
            className="w-full h-12 border-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            onClick={() => onOpenCreateDeal?.(stage.id)}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Deal</span>
            <span className="sm:hidden">Add</span>
          </Button>
          
          {/* Empty State */}
          {deals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <div className="text-sm opacity-75">No deals</div>
              <div className="text-xs mt-1 opacity-50">Drag deals here</div>
            </div>
          )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}
