import React, { useState } from 'react';
import { useConnectionRequestsPipeline, ConnectionRequestPipeline } from '@/hooks/admin/use-connection-requests-pipeline';
import { ConnectionRequestKanbanColumn } from './ConnectionRequestKanbanColumn';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { ConnectionRequestKanbanCard } from './ConnectionRequestKanbanCard';

export function ConnectionRequestKanbanView() {
  const { stages, requestsByStage, isLoading } = useConnectionRequestsPipeline();
  const [activeRequest, setActiveRequest] = useState<ConnectionRequestPipeline | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    // Find the request being dragged
    const draggedId = event.active.id as string;
    for (const stageRequests of Object.values(requestsByStage)) {
      const request = stageRequests.find(r => r.id === draggedId);
      if (request) {
        setActiveRequest(request);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRequest(null);

    if (!over) return;

    const requestId = active.id as string;
    const newStageId = over.id as string;

    // TODO: Implement stage update mutation
    console.log('Move request', requestId, 'to stage', newStageId);
  };

  const handleRequestSelect = (request: ConnectionRequestPipeline) => {
    console.log('Selected request:', request);
    // TODO: Open detail panel
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading connection requests...</div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">No Pipeline Stages</h3>
          <p className="text-muted-foreground">Configure pipeline stages to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-max">
          {stages.map((stage) => (
            <div key={stage.id} className="w-80 flex-shrink-0">
              <ConnectionRequestKanbanColumn
                stage={stage}
                requests={requestsByStage[stage.id] || []}
                onRequestSelect={handleRequestSelect}
              />
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeRequest && (
          <ConnectionRequestKanbanCard
            request={activeRequest}
            onSelect={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}