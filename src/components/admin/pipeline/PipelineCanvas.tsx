import React from 'react';
import { PipelineKanbanView } from './views/PipelineKanbanView';
import { PipelineListView } from './views/PipelineListView';
import { PipelineTableView } from './views/PipelineTableView';
import { ViewMode, PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineCanvasProps {
  viewMode: ViewMode;
  filters: PipelineFilters;
  onDealClick: (deal: Deal) => void;
  onCreateDeal: () => void;
  onManageStages: () => void;
  selectedDeal: Deal | null;
}

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({
  viewMode,
  filters,
  onDealClick,
  onCreateDeal,
  onManageStages,
  selectedDeal
}) => {
  const renderView = () => {
    switch (viewMode) {
      case 'kanban':
        return (
          <PipelineKanbanView
            filters={filters}
            onDealClick={onDealClick}
            onCreateDeal={onCreateDeal}
            onManageStages={onManageStages}
            selectedDeal={selectedDeal}
          />
        );
      case 'list':
        return (
          <PipelineListView
            filters={filters}
            onDealClick={onDealClick}
            selectedDeal={selectedDeal}
          />
        );
      case 'table':
        return (
          <PipelineTableView
            filters={filters}
            onDealClick={onDealClick}
            selectedDeal={selectedDeal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-hidden bg-muted/20">
      {renderView()}
    </div>
  );
};