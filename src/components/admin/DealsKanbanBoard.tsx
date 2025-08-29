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
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';
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
      {/* Action buttons only - title removed to avoid duplication */}
      <div className="flex items-center justify-end gap-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onManageStages}
          className="hover:scale-105 transition-transform duration-200"
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage Stages
        </Button>
        <Button 
          onClick={onCreateDeal}
          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Deal
        </Button>
      </div>

      {/* Pipeline metrics overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
          <CardContent className="p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              {deals.length}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Total Deals</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
          <CardContent className="p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-success to-success/80 bg-clip-text text-transparent">
              ${deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Total Value</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
          <CardContent className="p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-warning to-warning/80 bg-clip-text text-transparent">
              {deals.length > 0 
                ? Math.round(deals.reduce((sum, deal) => sum + deal.deal_probability, 0) / deals.length)
                : 0}%
            </div>
            <p className="text-sm text-muted-foreground font-medium">Avg Probability</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
          <CardContent className="p-6">
            <div className="text-2xl font-bold bg-gradient-to-r from-info to-info/80 bg-clip-text text-transparent">
              {deals.reduce((sum, deal) => sum + deal.pending_tasks, 0)}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Pending Tasks</p>
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
        <div className="flex gap-6 overflow-x-auto pb-6 px-1">
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
            <EnhancedDealKanbanCard deal={activeDeal} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}