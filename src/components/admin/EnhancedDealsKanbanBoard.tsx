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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, TrendingUp, CheckCircle2, Clock, Target } from 'lucide-react';
import { useDeals, useDealStages, useUpdateDealStage, Deal } from '@/hooks/admin/use-deals';
import { useDealFilters } from '@/hooks/admin/use-deal-filters';
import { DealKanbanColumn } from './DealKanbanColumn';
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';
import { DealFilters } from './DealFilters';
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
    const targetStage = stages.find(s => s.id === newStageId);
    
    if (!deal || !targetStage || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }

    // Update the deal stage
    updateDealStage.mutate({ 
      dealId, 
      stageId: newStageId,
      fromStage: deal.stage_name || undefined,
      toStage: targetStage.name
    });
    setActiveId(null);
  };

  if (dealsLoading || stagesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="flex gap-6 overflow-x-auto">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-80 h-96 flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sophisticated Filter Bar */}
      <div>
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


      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto border rounded-lg">
          <div className="flex gap-6 p-4" style={{ minHeight: '600px' }}>
            {stageMetrics.map((stage) => (
              <DealKanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onDealClick={onDealClick}
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
  );
}