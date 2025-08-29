import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeals, useDealStages, useUpdateDealStage, Deal, DealStage } from '@/hooks/admin/use-deals';
import { DealKanbanCard } from './DealKanbanCard';
import { DealKanbanColumn } from './DealKanbanColumn';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Plus, Settings, Filter } from 'lucide-react';

interface DealsKanbanBoardProps {
  onCreateDeal?: () => void;
  onManageStages?: () => void;
  onDealClick?: (deal: Deal) => void;
}

export function DealsKanbanBoard({ 
  onCreateDeal, 
  onManageStages, 
  onDealClick 
}: DealsKanbanBoardProps) {
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const updateDealStage = useUpdateDealStage();
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    priority: '',
    assignedTo: '',
    source: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const filteredDeals = deals.filter(deal => {
      if (filters.priority && deal.deal_priority !== filters.priority) return false;
      if (filters.assignedTo && deal.assigned_to !== filters.assignedTo) return false;
      if (filters.source && deal.deal_source !== filters.source) return false;
      return true;
    });

    return stages.reduce((acc, stage) => {
      acc[stage.id] = filteredDeals.filter(deal => deal.stage_id === stage.id);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [deals, stages, filters]);

  // Calculate stage metrics
  const stageMetrics = useMemo(() => {
    return stages.map(stage => {
      const stageDeals = dealsByStage[stage.id] || [];
      const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0);
      const avgProbability = stageDeals.length > 0 
        ? stageDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / stageDeals.length 
        : 0;
      
      return {
        ...stage,
        dealCount: stageDeals.length,
        totalValue,
        avgProbability,
      };
    });
  }, [stages, dealsByStage]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed for real-time updates
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the deal being dragged
    const activeDeal = deals.find(deal => deal.deal_id === activeId);
    if (!activeDeal) {
      setActiveId(null);
      return;
    }

    // Check if dropping on a different stage
    const targetStage = stages.find(stage => stage.id === overId);
    if (targetStage && activeDeal.stage_id !== targetStage.id) {
      updateDealStage.mutate({
        dealId: activeDeal.deal_id,
        stageId: targetStage.id,
      });
    }

    setActiveId(null);
  };

  const activeDeal = activeId ? deals.find(deal => deal.deal_id === activeId) : null;

  if (dealsLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deals Pipeline</h2>
          <p className="text-muted-foreground">
            Manage your deals through the sales pipeline
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onManageStages}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Stages
          </Button>
          <Button onClick={onCreateDeal}>
            <Plus className="h-4 w-4 mr-2" />
            Create Deal
          </Button>
        </div>
      </div>

      {/* Pipeline metrics overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{deals.length}</div>
            <p className="text-xs text-muted-foreground">Total Deals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              ${deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {deals.length > 0 
                ? Math.round(deals.reduce((sum, deal) => sum + deal.deal_probability, 0) / deals.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Avg Probability</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {deals.reduce((sum, deal) => sum + deal.pending_tasks, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Pending Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {stageMetrics.map((stage) => (
            <DealKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onDealClick={onDealClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealKanbanCard deal={activeDeal} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}