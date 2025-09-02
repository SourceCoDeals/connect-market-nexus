import React from 'react';
import { useConnectionRequestPipelineCore } from '@/hooks/admin/use-connection-request-pipeline-core';
import { PipelineWorkspace } from './PipelineWorkspace';

export function ConnectionRequestPipelineShell() {
  const pipeline = useConnectionRequestPipelineCore();

  if (pipeline.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (pipeline.error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 font-medium">Error loading pipeline</div>
        <div className="text-sm text-muted-foreground mt-2">
          {pipeline.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm z-10">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Connection Request Pipeline</h1>
              <p className="text-muted-foreground">
                {pipeline.metrics.totalRequests} requests across {pipeline.stages.length} stages
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick metrics */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold">{pipeline.metrics.qualifiedBuyers}</div>
                  <div className="text-muted-foreground">Qualified</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{pipeline.metrics.documentsCompleted}</div>
                  <div className="text-muted-foreground">Docs Complete</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{pipeline.metrics.conversionRate.toFixed(1)}%</div>
                  <div className="text-muted-foreground">Conversion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Content */}
      <div className="flex-1 overflow-hidden">
        <PipelineWorkspace pipeline={pipeline} />
      </div>
    </div>
  );
}