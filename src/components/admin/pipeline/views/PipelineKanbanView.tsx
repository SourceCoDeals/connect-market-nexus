
import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { useUpdateDealStage } from '@/hooks/admin/use-deals';
import { PipelineKanbanColumn } from './PipelineKanbanColumn';
import { PipelineKanbanCard } from './PipelineKanbanCard';
import { PipelineKanbanCardOverlay } from './PipelineKanbanCardOverlay';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PipelineKanbanViewProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineKanbanView({ pipeline }: PipelineKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const updateDealStage = useUpdateDealStage();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    console.log('Kanban DnD: drag start', { activeId: event.active.id });
    setActiveId(event.active.id as string);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('Kanban DnD: drag end', { active: active?.id, over: over?.id });
    
    if (!over || !pipeline.deals) {
      console.log('Kanban DnD: no drop target or no deals');
      setActiveId(null);
      return;
    }
    
    const dealId = String(active.id);
    const overId = String(over.id);
    
    // Default to treating the drop target as a stage id
    let newStageId = overId;
    
    // If overId matches a deal id, derive the target stage from that deal
    const overDeal = pipeline.deals.find(d => d.deal_id === overId);
    if (overDeal?.stage_id) {
      newStageId = overDeal.stage_id;
      console.log('Kanban DnD: over matched a deal; derived stage', { overDealId: overId, derivedStageId: newStageId });
    }
    
    const deal = pipeline.deals.find(d => d.deal_id === dealId);
    // Use ALL stages (not just displayStages) for drag target validation
    const targetStage = pipeline.stages.find(s => s.id === newStageId);
    
    if (!deal || !targetStage) {
      console.log('Kanban DnD: invalid deal or target stage', { dealFound: !!deal, targetFound: !!targetStage });
      setActiveId(null);
      return;
    }

    if (deal.stage_id === newStageId) {
      console.log('Kanban DnD: dropped in same stage, ignoring');
      setActiveId(null);
      return;
    }
    
    console.log('Kanban DnD: updating deal stage', { dealId, fromStage: deal.stage_name, toStage: targetStage.name });
    updateDealStage.mutate({ 
      dealId, 
      stageId: newStageId,
      fromStage: deal.stage_name || undefined,
      toStage: targetStage.name
    });
    setActiveId(null);
  };
  
  const scrollToStage = (direction: 'left' | 'right') => {
    const container = document.getElementById('kanban-scroll-container');
    if (container) {
      const scrollAmount = 320; // Column width
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };
  
  if (pipeline.stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground mb-2">No stages configured</p>
          <p className="text-sm text-muted-foreground">Create deal stages to start managing your pipeline</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 relative overflow-hidden">
          {/* Mobile: Horizontal scroll navigation */}
          <div className="md:hidden absolute top-2 right-2 z-20 flex gap-1 bg-background/95 backdrop-blur-sm rounded-lg p-1 shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToStage('left')}
              className="h-7 w-7 p-0 border-muted-foreground/20"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToStage('right')}
              className="h-7 w-7 p-0 border-muted-foreground/20"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Kanban Container */}
          <div 
            id="kanban-scroll-container"
            className="absolute inset-0 overflow-x-auto overflow-y-hidden touch-pan-x"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <div 
              className="flex gap-2 sm:gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4 min-w-full"
              style={{ 
                width: 'max-content',
                height: '100%'
              }}
            >
              {(pipeline.displayStages || pipeline.stages).map((stage) => {
                const stageDeals = pipeline.dealsByStage[stage.id] || [];
                const metricsEntry = Array.isArray(pipeline.stageMetrics)
                  ? (pipeline.stageMetrics as any[]).find((m: any) => m.id === stage.id)
                  : undefined;
                const metrics = metricsEntry || { dealCount: stageDeals.length, totalValue: 0, avgProbability: 0 };
                
                return (
                  <div 
                    key={stage.id}
                    className="flex-shrink-0 w-64 sm:w-72 lg:w-80"
                  >
                    <PipelineKanbanColumn
                      stage={{
                        ...stage,
                        dealCount: metrics.dealCount,
                        totalValue: metrics.totalValue,
                        avgProbability: metrics.avgProbability,
                        deals: stageDeals
                      }}
                      deals={stageDeals}
                      onDealClick={pipeline.handleDealSelect}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <DragOverlay>
          {activeId ? (() => {
            const activeDeal = pipeline.deals.find(d => d.deal_id === activeId);
            if (!activeDeal) return null;
            return (
              <PipelineKanbanCardOverlay deal={activeDeal} />
            );
          })() : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
