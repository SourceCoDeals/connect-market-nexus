import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineKanbanView } from './views/PipelineKanbanView';
import { PipelineListView } from './views/PipelineListView';
import { PipelineTableView } from './views/PipelineTableView';
import { PipelineMetricsCard } from '@/components/admin/PipelineMetricsCard';

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
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <PipelineMetricsCard metrics={pipeline.metrics} />
      <div className="flex-1 overflow-hidden">{renderView()}</div>
    </div>
  );
}
