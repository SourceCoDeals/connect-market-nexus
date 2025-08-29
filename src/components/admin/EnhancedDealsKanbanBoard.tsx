import React, { useState, useMemo } from 'react';
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
import { useDeals, useDealStages, useUpdateDealStage, Deal } from '@/hooks/admin/use-deals';
import { useDealFilters } from '@/hooks/admin/use-deal-filters';
import { useViewportDimensions } from '@/hooks/useViewportDimensions';
import { DealKanbanColumn } from './DealKanbanColumn';
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';
import { DealFilters } from './DealFilters';
import { PipelineMetrics } from './PipelineMetrics';
import { Skeleton } from '@/components/ui/skeleton';

interface EnhancedDealsKanbanBoardProps {
  onCreateDeal?: () => void;
  onManageStages?: () => void;
  onDealClick?: (deal: Deal) => void;
}

export function EnhancedDealsKanbanBoard({ onCreateDeal, onManageStages, onDealClick }: EnhancedDealsKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: stages, isLoading: stagesLoading } = useDealStages();
  const updateDealStage = useUpdateDealStage();
  const { availableHeight } = useViewportDimensions();

  const {
    searchQuery,
    statusFilter,
    buyerTypeFilter,
    listingFilter,
    adminFilter,
    documentStatusFilter,
    sortOption,
    filteredAndSortedDeals,
    setSearchQuery,
    setStatusFilter,
    setBuyerTypeFilter,
    setListingFilter,
    setAdminFilter,
    setDocumentStatusFilter,
    setSortOption,
  } = useDealFilters(deals || []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group filtered deals by stage
  const dealsByStage = useMemo(() => {
    if (!filteredAndSortedDeals || !stages) return {};
    
    const grouped = stages.reduce((acc, stage) => {
      acc[stage.id] = filteredAndSortedDeals.filter(deal => deal.stage_id === stage.id);
      return acc;
    }, {} as Record<string, Deal[]>);
    
    return grouped;
  }, [filteredAndSortedDeals, stages]);

  // Calculate metrics for each stage based on filtered data
  const stageMetrics = useMemo(() => {
    if (!stages || !dealsByStage) return [];
    
    return stages.map(stage => {
      const stageDeals = dealsByStage[stage.id] || [];
      const totalValue = stageDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
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

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (!filteredAndSortedDeals) return { totalDeals: 0, totalValue: 0, avgProbability: 0, pendingTasks: 0 };
    
    const totalValue = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
    const avgProbability = filteredAndSortedDeals.length > 0 
      ? filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / filteredAndSortedDeals.length 
      : 0;
    const pendingTasks = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.pending_tasks, 0);
    
    return {
      totalDeals: filteredAndSortedDeals.length,
      totalValue,
      avgProbability,
      pendingTasks,
    };
  }, [filteredAndSortedDeals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !filteredAndSortedDeals) {
      setActiveId(null);
      return;
    }

    const dealId = active.id as string;
    const newStageId = over.id as string;
    
    // Find the deal being moved
    const deal = filteredAndSortedDeals.find(d => d.deal_id === dealId);
    if (!deal || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }

    // Update the deal stage
    updateDealStage.mutate({ dealId, stageId: newStageId });
    setActiveId(null);
  };

  if (dealsLoading || stagesLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-background border-b border-border/30 px-6 py-3">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="bg-background border-b border-border/30 px-6 py-4">
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex-1 p-4">
          <div className="flex gap-4 h-full overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="flex-shrink-0 w-80 h-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HubSpot-style Filters Bar */}
      <div className="bg-background border-b border-border/30 px-6 py-3 flex-shrink-0">
        <DealFilters
          deals={deals || []}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          buyerTypeFilter={buyerTypeFilter}
          listingFilter={listingFilter}
          adminFilter={adminFilter}
          documentStatusFilter={documentStatusFilter}
          sortOption={sortOption}
          onSearchChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onBuyerTypeFilterChange={setBuyerTypeFilter}
          onListingFilterChange={setListingFilter}
          onAdminFilterChange={setAdminFilter}
          onDocumentStatusFilterChange={setDocumentStatusFilter}
          onSortChange={setSortOption}
        />
      </div>

      {/* Pipeline Metrics Dashboard */}
      <div className="flex-shrink-0">
        <PipelineMetrics deals={filteredAndSortedDeals || []} />
      </div>

      {/* Kanban Board with HubSpot-style Scrolling */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <div 
              className="h-full flex gap-4 p-4"
              style={{ 
                minWidth: `${stageMetrics.length * 320}px`,
                paddingRight: '20px' // Extra padding for smooth scrolling
              }}
            >
              {stageMetrics.map((stage) => (
                <DealKanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage[stage.id] || []}
                  onDealClick={onDealClick}
                  availableHeight={availableHeight}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeId ? (
              <EnhancedDealKanbanCard 
                deal={filteredAndSortedDeals?.find(d => d.deal_id === activeId)!} 
                isDragging 
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}