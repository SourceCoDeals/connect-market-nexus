import React from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineKanbanView } from './views/PipelineKanbanView';
import { PipelineListView } from './views/PipelineListView';
import { PipelineTableView } from './views/PipelineTableView';
import { PremiumDealDetailModal } from './PremiumDealDetailModal';

interface PipelineWorkspaceProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineWorkspace({ pipeline }: PipelineWorkspaceProps) {
  const renderView = () => {

    switch (pipeline.viewMode) {
      case 'kanban':
        return <PipelineKanbanView pipeline={pipeline} />;
      case 'list':
        return <PipelineListView pipeline={pipeline} />;
      case 'table':
        return <PipelineTableView pipeline={pipeline} />;
      default:
        return <PipelineKanbanView pipeline={pipeline} />;
    }
  };
  
  return (
    <div className="h-full overflow-hidden bg-background">
      {renderView()}
      
      {/* Premium Deal Detail Modal */}
      <PremiumDealDetailModal
        deal={pipeline.selectedDeal}
        open={pipeline.isDetailPanelOpen}
        onOpenChange={pipeline.setIsDetailPanelOpen}
      />
    </div>
  );
}