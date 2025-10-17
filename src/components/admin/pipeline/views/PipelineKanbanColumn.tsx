
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { PipelineKanbanCard } from './PipelineKanbanCard';
import { cn } from '@/lib/utils';

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
    <div 
      ref={setNodeRef}
      className={cn(
        "h-full flex flex-col transition-colors duration-150 rounded-xl",
        isOver ? 'bg-primary/5' : 'bg-transparent'
      )}
    >
      {/* Minimal Column Header */}
      <div className="pb-3 px-2 flex-shrink-0 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-[13px] text-foreground/90 truncate">
              {stage.name}
            </h3>
            <span className="text-[11px] font-medium text-muted-foreground/60 flex-shrink-0">
              {stage.dealCount}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Minimal Progress Bar */}
        {!isClosedLost && (
          <div className="w-full h-0.5 bg-muted/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary/60 to-primary/40 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Deals List */}
      <div 
        className="flex-1 px-2 pb-2 overflow-y-auto"
      >
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-full">
            {deals.map((deal) => {
              console.log('[Pipeline Column] Rendering card for deal:', {
                deal_id: deal.deal_id,
                title: deal.title,
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
            className="w-full h-10 border border-dashed border-border/30 text-muted-foreground/50 hover:text-foreground/70 hover:border-border/50 transition-colors text-[11px] rounded-lg"
            onClick={() => onOpenCreateDeal?.(stage.id)}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add
          </Button>
          
          {/* Empty State */}
          {deals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/40">
              <div className="text-[11px]">No deals</div>
            </div>
          )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
