import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ConnectionRequestKanbanCard } from './ConnectionRequestKanbanCard';
import type { StageWithMetrics } from '@/hooks/admin/use-connection-request-pipeline-core';
import type { ConnectionRequestPipelineItem } from '@/hooks/admin/use-connection-request-pipeline';

interface ConnectionRequestKanbanColumnProps {
  stage: StageWithMetrics;
  requests: ConnectionRequestPipelineItem[];
  onRequestClick: (requestId: string) => void;
}

export function ConnectionRequestKanbanColumn({ 
  stage, 
  requests, 
  onRequestClick 
}: ConnectionRequestKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (score: number) => {
    if (score >= 5) return 'bg-red-100 text-red-800 border-red-200';
    if (score >= 4) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 2) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Card 
      ref={setNodeRef}
      className={`w-80 min-w-80 flex flex-col transition-colors ${
        isOver ? 'ring-2 ring-primary' : ''
      }`}
      style={{ height: 'calc(100vh - 200px)' }}
    >
      <CardHeader className="pb-3 space-y-2">
        {/* Stage Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {stage.requestCount}
          </Badge>
        </div>

        {/* Stage Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="block font-medium">Total Value</span>
            <span>{formatCurrency(stage.totalValue)}</span>
          </div>
          <div>
            <span className="block font-medium">Avg Priority</span>
            <span>{stage.avgPriorityScore.toFixed(1)}</span>
          </div>
          <div>
            <span className="block font-medium">Documents</span>
            <span>{stage.documentsCompleteCount}/{stage.requestCount}</span>
          </div>
          <div>
            <span className="block font-medium">Conversion</span>
            <span>--</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-3 pt-0 min-h-0">
        {/* Requests List */}
        <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
          {requests.map((request) => (
            <ConnectionRequestKanbanCard
              key={request.id}
              request={request}
              onRequestClick={onRequestClick}
            />
          ))}
        </div>

        {/* Empty State */}
        {requests.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-sm">No requests</div>
            </div>
          </div>
        )}

        {/* Add New Button */}
        <div className="pt-2 mt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => {
              // TODO: Implement add new request functionality
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}