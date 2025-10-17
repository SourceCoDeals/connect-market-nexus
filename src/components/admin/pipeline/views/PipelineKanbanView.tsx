
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
  onOpenCreateDeal?: (stageId?: string) => void;
}

export function PipelineKanbanView({ pipeline, onOpenCreateDeal }: PipelineKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const updateDealStage = useUpdateDealStage();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    console.log('[Pipeline DnD] dragStart', { activeId: id });
    setActiveId(id);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    const activeIdStr = String(active?.id ?? '');
    const overIdStr = String(over?.id ?? '');
    console.log('[Pipeline DnD] dragEnd', { activeId: activeIdStr, overId: overIdStr });

    if (!over || !pipeline.deals) {
      setActiveId(null);
      return;
    }

    // Extract deal ID from active (format: "deal:uuid")
    const dealId = activeIdStr.startsWith('deal:') ? activeIdStr.slice(5) : activeIdStr;

    // Determine destination stage ID
    let destStageId: string | null = null;
    if (overIdStr.startsWith('stage:')) {
      // Dropped directly on column
      destStageId = overIdStr.slice(6);
    } else if (overIdStr.startsWith('deal:')) {
      // Dropped on another deal - find that deal's stage
      const overDealId = overIdStr.slice(5);
      const overDeal = pipeline.deals.find(d => d.deal_id === overDealId);
      destStageId = overDeal?.stage_id || null;
    }

    if (!destStageId) {
      setActiveId(null);
      return;
    }

    const deal = pipeline.deals.find(d => d.deal_id === dealId);
    const targetStage = pipeline.stages.find(s => s.id === destStageId);

    console.log('[Pipeline DnD] move', { 
      dealId, 
      dealTitle: deal?.title,
      fromStage: deal?.stage_name, 
      toStage: targetStage?.name,
      currentStageEnteredAt: deal?.deal_stage_entered_at 
    });

    if (!deal || !targetStage || deal.stage_id === destStageId) {
      setActiveId(null);
      return;
    }

    updateDealStage.mutate({
      dealId,
      stageId: destStageId,
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
              className="flex gap-3 sm:gap-4 lg:gap-5 p-3 sm:p-4 lg:p-5 min-w-full group"
              style={{ 
                width: 'max-content',
                height: '100%'
              }}
            >
              {pipeline.stageMetrics.map((stage) => (
                <div 
                  key={stage.id}
                  className="flex-shrink-0 w-64 sm:w-72 lg:w-80"
                >
                  <PipelineKanbanColumn
                    stage={stage}
                    deals={pipeline.dealsByStage[stage.id] || []}
                    onDealClick={pipeline.handleDealSelect}
                    onOpenCreateDeal={onOpenCreateDeal}
                    totalStages={pipeline.stages.length}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DragOverlay>
          {activeId ? (() => {
            const dealId = String(activeId).startsWith('deal:') ? String(activeId).slice(5) : String(activeId);
            const activeDeal = pipeline.deals.find(d => d.deal_id === dealId);
            console.log('[Pipeline DnD] overlay render', { activeId, dealId, found: !!activeDeal });
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
