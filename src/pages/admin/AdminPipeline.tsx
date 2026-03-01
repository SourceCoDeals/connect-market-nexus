import { useEffect } from 'react';
import { PipelineShell } from '@/components/admin/pipeline/PipelineShell';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';

export default function AdminPipeline() {
  // Register AI Command Center context
  const { setPageContext } = useAICommandCenterContext();
  useEffect(() => {
    setPageContext({ page: 'pipeline', entity_type: 'deals' });
  }, [setPageContext]);

  return (
    <AdminErrorBoundary component="AdminPipeline">
      <PipelineShell />
    </AdminErrorBoundary>
  );
}