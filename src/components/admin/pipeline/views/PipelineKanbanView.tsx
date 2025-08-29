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

interface PipelineKanbanViewProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineKanbanView({ pipeline }: PipelineKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
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
    
    // Find the deal being moved
    const deal = pipeline.deals.find(d => d.deal_id === dealId);
    if (!deal || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }
    
    // Update the deal stage
    updateDealStage.mutate({ dealId, stageId: newStageId });
    setActiveId(null);
  };
  
  if (pipeline.stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/10">
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
        {/* Kanban Board Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto">
            <div 
              className="flex gap-4 p-4 h-full"
              style={{ 
                minWidth: pipeline.isMobile ? 'auto' : `${pipeline.stageMetrics.length * 320}px`,
                minHeight: '600px'
              }}
            >
              {pipeline.stageMetrics.map((stage) => (
                <PipelineKanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={pipeline.dealsByStage[stage.id] || []}
                  onDealClick={pipeline.handleDealSelect}
                  isMobile={pipeline.isMobile}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <PipelineKanbanCard 
              deal={pipeline.deals.find(d => d.deal_id === activeId)!} 
              isDragging
              onDealClick={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}