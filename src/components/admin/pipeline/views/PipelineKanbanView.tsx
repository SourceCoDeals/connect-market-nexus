
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
    if (!deal || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }
    
    updateDealStage.mutate({ dealId, stageId: newStageId });
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
        <div className="flex-1 relative">
          {/* Mobile: Horizontal scroll navigation */}
          <div className="md:hidden absolute top-4 right-4 z-10 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToStage('left')}
              className="h-8 w-8 p-0 bg-background/80 backdrop-blur"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToStage('right')}
              className="h-8 w-8 p-0 bg-background/80 backdrop-blur"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Kanban Container */}
          <div 
            id="kanban-scroll-container"
            className="h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
          >
            <div 
              className="flex gap-3 md:gap-4 p-3 md:p-6 h-full"
              style={{ 
                minHeight: 'calc(100vh - 200px)',
                width: `max-content`
              }}
            >
              {pipeline.stageMetrics.map((stage) => (
                <div 
                  key={stage.id}
                  className="flex-shrink-0 w-72 sm:w-80"
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
