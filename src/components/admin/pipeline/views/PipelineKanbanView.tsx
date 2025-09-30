
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
} from '@dnd-kit/core';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { useUpdateDealStage } from '@/hooks/admin/use-deals';
import { PipelineKanbanColumn } from './PipelineKanbanColumn';
import { PipelineKanbanCard } from './PipelineKanbanCard';
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
    setActiveId(event.active.id as string);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !pipeline.deals) {
      setActiveId(null);
      return;
    }
    
    const dealId = active.id as string;
    const newStageId = over.id as string;
    
    const deal = pipeline.deals.find(d => d.deal_id === dealId);
    const targetStage = pipeline.stages.find(s => s.id === newStageId);
    
    if (!deal || !targetStage || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }
    
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
              {pipeline.stageMetrics.map((stage) => (
                <div 
                  key={stage.id}
                  className="flex-shrink-0 w-64 sm:w-72 lg:w-80"
                >
                  <PipelineKanbanColumn
                    stage={stage}
                    deals={pipeline.dealsByStage[stage.id] || []}
                    onDealClick={pipeline.handleDealSelect}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DragOverlay>
          {activeId ? (
            <div className="rotate-3 scale-105">
              <PipelineKanbanCard 
                deal={pipeline.deals.find(d => d.deal_id === activeId)!} 
                isDragging
                onDealClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
