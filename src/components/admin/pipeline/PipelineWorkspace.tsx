import React from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineKanbanView } from './views/PipelineKanbanView';
import { PipelineListView } from './views/PipelineListView';
import { PipelineTableView } from './views/PipelineTableView';

interface PipelineWorkspaceProps {
  pipeline: ReturnType<typeof usePipelineCore>;
  onOpenCreateDeal?: (stageId?: string) => void;
}

export function PipelineWorkspace({ pipeline, onOpenCreateDeal }: PipelineWorkspaceProps) {
  const renderView = () => {

    switch (pipeline.viewMode) {
      case 'kanban':
        return <PipelineKanbanView pipeline={pipeline} onOpenCreateDeal={onOpenCreateDeal} />;
      case 'list':
        return <PipelineListView pipeline={pipeline} />;
      case 'table':
        return <PipelineTableView pipeline={pipeline} />;
      default:
        return <PipelineKanbanView pipeline={pipeline} onOpenCreateDeal={onOpenCreateDeal} />;
    }
  };
  
  return (
    <div className="h-full overflow-hidden bg-background">
      {renderView()}
    </div>
  );
}