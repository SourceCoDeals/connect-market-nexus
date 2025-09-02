import React from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineKanbanView } from './views/PipelineKanbanView';
import { PipelineListView } from './views/PipelineListView';
import { PipelineTableView } from './views/PipelineTableView';
import { ConnectionRequestKanbanView } from './connection-requests/ConnectionRequestKanbanView';
import { PipelineMode } from './PipelineShell';

interface PipelineWorkspaceProps {
  pipeline: ReturnType<typeof usePipelineCore>;
  pipelineMode: PipelineMode;
}

export function PipelineWorkspace({ pipeline, pipelineMode }: PipelineWorkspaceProps) {
  const renderView = () => {
    if (pipelineMode === 'connection-requests') {
      return <ConnectionRequestKanbanView />;
    }

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
    </div>
  );
}