import React from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useConnectionRequestPipelineCore } from '@/hooks/admin/use-connection-request-pipeline-core';
import { useUpdateConnectionRequestStage } from '@/hooks/admin/use-connection-request-pipeline';
import { ConnectionRequestKanbanColumn } from './ConnectionRequestKanbanColumn';
import { ConnectionRequestKanbanCard } from './ConnectionRequestKanbanCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef } from 'react';

interface ConnectionRequestKanbanViewProps {
  pipeline: ReturnType<typeof useConnectionRequestPipelineCore>;
}

export function ConnectionRequestKanbanView({ pipeline }: ConnectionRequestKanbanViewProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const updateStageMutation = useUpdateConnectionRequestStage();

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    const requestId = active.id as string;
    const newStageId = over.id as string;

    // Find the request to get current stage
    const request = pipeline.requests.find(r => r.id === requestId);
    if (!request || request.pipeline_stage_id === newStageId) return;

    updateStageMutation.mutate({ requestId, stageId: newStageId });
  };

  const handleDragOver = (event: any) => {
    // Allow dropping on stage columns
    event.preventDefault();
  };

  const scrollToStage = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const newIndex = direction === 'left' 
      ? Math.max(0, currentStageIndex - 1)
      : Math.min(pipeline.stageMetrics.length - 1, currentStageIndex + 1);
    
    setCurrentStageIndex(newIndex);
    
    const stageWidth = container.clientWidth * 0.85; // Approximate stage width
    container.scrollTo({
      left: newIndex * stageWidth,
      behavior: 'smooth'
    });
  };

  const draggedRequest = draggedItem 
    ? pipeline.requests.find(r => r.id === draggedItem)
    : null;

  if (pipeline.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 relative overflow-hidden">
        {/* Mobile: Horizontal scroll navigation */}
        <div className="md:hidden absolute top-2 right-2 z-20 flex gap-1 bg-background/95 backdrop-blur-sm rounded-lg p-1 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToStage('left')}
            disabled={currentStageIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToStage('right')}
            disabled={currentStageIndex === pipeline.stageMetrics.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Kanban Container */}
        <div 
          ref={scrollContainerRef}
          id="kanban-scroll-container"
          className="absolute inset-0 overflow-x-auto overflow-y-hidden touch-pan-x"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div 
            className="flex gap-2 sm:gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4 min-w-full"
            style={{ 
              width: 'max-content',
              height: '100%'
            }}
          >
            {pipeline.stageMetrics.map((stage) => {
              const stageRequests = pipeline.requestsByStage.get(stage.id) || [];
              
              return (
                <SortableContext
                  key={stage.id}
                  id={stage.id}
                  items={stageRequests.map(r => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ConnectionRequestKanbanColumn
                    stage={stage}
                    requests={stageRequests}
                    onRequestClick={pipeline.handleRequestSelect}
                  />
                </SortableContext>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedRequest && (
          <ConnectionRequestKanbanCard
            request={draggedRequest}
            onRequestClick={() => {}}
            isDragging={true}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}