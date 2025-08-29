import React from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { PipelineKanbanColumn } from './PipelineKanbanColumn';
import { PipelineKanbanCard } from './PipelineKanbanCard';
import { useDeals, useDealStages, useUpdateDealStage } from '@/hooks/admin/use-deals';
import { PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { Deal } from '@/hooks/admin/use-deals';
import { useMemo } from 'react';

interface PipelineKanbanViewProps {
  filters: PipelineFilters;
  onDealClick: (deal: Deal) => void;
  onCreateDeal: () => void;
  onManageStages: () => void;
  selectedDeal: Deal | null;
}

export const PipelineKanbanView: React.FC<PipelineKanbanViewProps> = ({
  filters,
  onDealClick,
  onCreateDeal,
  onManageStages,
  selectedDeal
}) => {
  const { data: deals = [], isLoading } = useDeals();
  const { data: stages = [] } = useDealStages();
  const updateDealStage = useUpdateDealStage();

  // Filter deals based on current filters
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Search filter
      if (filters.search && !deal.deal_title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Stage filter
      if (filters.stage !== 'all' && deal.stage_name?.toLowerCase() !== filters.stage) {
        return false;
      }

      // Priority filter
      if (filters.priority !== 'all' && deal.deal_priority !== filters.priority) {
        return false;
      }

      // Deal value filter
      const dealValue = deal.deal_value || 0;
      if (dealValue < filters.dealValue[0] || dealValue > filters.dealValue[1]) {
        return false;
      }

      return true;
    });
  }, [deals, filters]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    
    stages.forEach(stage => {
      grouped[stage.id] = filteredDeals.filter(deal => deal.stage_id === stage.id);
    });

    return grouped;
  }, [filteredDeals, stages]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;
    
    updateDealStage.mutate({
      dealId,
      stageId: newStageId
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-6 min-w-max">
          {stages.map(stage => (
            <PipelineKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onDealClick={onDealClick}
              selectedDeal={selectedDeal}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
};