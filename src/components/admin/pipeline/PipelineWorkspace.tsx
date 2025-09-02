import React from 'react';
import { useConnectionRequestPipelineCore } from '@/hooks/admin/use-connection-request-pipeline-core';
import { ConnectionRequestKanbanView } from './views/ConnectionRequestKanbanView';

interface PipelineWorkspaceProps {
  pipeline: ReturnType<typeof useConnectionRequestPipelineCore>;
}

export function PipelineWorkspace({ pipeline }: PipelineWorkspaceProps) {
  const renderView = () => {
    switch (pipeline.viewMode) {
      case 'kanban':
        return <ConnectionRequestKanbanView pipeline={pipeline} />;
      case 'list':
        return <div>List view - Coming soon</div>;
      case 'table':
        return <div>Table view - Coming soon</div>;
      default:
        return <ConnectionRequestKanbanView pipeline={pipeline} />;
    }
  };
  
  return (
    <div className="h-full overflow-hidden bg-background">
      {renderView()}
    </div>
  );
}