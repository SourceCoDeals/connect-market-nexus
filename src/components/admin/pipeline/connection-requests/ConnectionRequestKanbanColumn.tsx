import React from 'react';
import { ConnectionRequestStage } from '@/hooks/admin/use-connection-request-stages';
import { ConnectionRequestPipeline } from '@/hooks/admin/use-connection-requests-pipeline';
import { ConnectionRequestKanbanCard } from './ConnectionRequestKanbanCard';
import { Badge } from '@/components/ui/badge';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface ConnectionRequestKanbanColumnProps {
  stage: ConnectionRequestStage;
  requests: ConnectionRequestPipeline[];
  onRequestSelect: (request: ConnectionRequestPipeline) => void;
}

export function ConnectionRequestKanbanColumn({ 
  stage, 
  requests, 
  onRequestSelect 
}: ConnectionRequestKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const requestIds = requests.map(request => request.id);

  return (
    <div 
      ref={setNodeRef}
      className={`
        flex flex-col bg-muted/30 rounded-lg border h-full
        ${isOver ? 'border-primary/50 bg-primary/5' : 'border-border'}
      `}
    >
      {/* Column Header */}
      <div className="p-4 border-b bg-background/50 rounded-t-lg">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-sm text-foreground">{stage.name}</h3>
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
          >
            {requests.length}
          </Badge>
        </div>
        {stage.description && (
          <p className="text-xs text-muted-foreground">{stage.description}</p>
        )}
      </div>

      {/* Column Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        <SortableContext items={requestIds} strategy={verticalListSortingStrategy}>
          {requests.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No requests
            </div>
          ) : (
            requests.map((request) => (
              <ConnectionRequestKanbanCard
                key={request.id}
                request={request}
                onSelect={onRequestSelect}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}