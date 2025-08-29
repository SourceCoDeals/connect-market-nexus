import React from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineHeader } from './PipelineHeader';
import { PipelineMetrics } from './PipelineMetrics';
import { PipelineWorkspace } from './PipelineWorkspace';
import { PipelineDetailPanel } from './PipelineDetailPanel';
import { PipelineFilterPanel } from './PipelineFilterPanel';
import { Skeleton } from '@/components/ui/skeleton';

export function PipelineShell() {
  const pipeline = usePipelineCore();
  
  if (pipeline.isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Skeleton className="h-16 w-full" />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-96">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="pipeline-shell">
      {/* CSS Grid Layout */}
      <style>{`
        .pipeline-shell {
          display: grid;
          grid-template-areas: 
            "header header"
            "metrics metrics"
            "workspace detail";
          grid-template-columns: 1fr auto;
          grid-template-rows: auto auto 1fr;
          height: 100vh;
          background: hsl(var(--background));
        }
        
        @media (max-width: 1024px) {
          .pipeline-shell {
            grid-template-areas: 
              "header"
              "metrics"
              "workspace";
            grid-template-columns: 1fr;
          }
        }
        
        .pipeline-header { grid-area: header; }
        .pipeline-metrics { grid-area: metrics; }
        .pipeline-workspace { grid-area: workspace; }
        .pipeline-detail { grid-area: detail; }
      `}</style>
      
      {/* Header */}
      <div className="pipeline-header">
        <PipelineHeader pipeline={pipeline} />
      </div>
      
      {/* Metrics Dashboard */}
      {!pipeline.isMetricsCollapsed && (
        <div className="pipeline-metrics">
          <PipelineMetrics pipeline={pipeline} />
        </div>
      )}
      
      {/* Main Workspace */}
      <div className="pipeline-workspace">
        <PipelineWorkspace pipeline={pipeline} />
      </div>
      
      {/* Detail Panel */}
      {(pipeline.isDetailPanelOpen || (!pipeline.isMobile && pipeline.selectedDeal)) && (
        <div className="pipeline-detail">
          <PipelineDetailPanel pipeline={pipeline} />
        </div>
      )}
      
      {/* Filter Panel Overlay */}
      <PipelineFilterPanel pipeline={pipeline} />
    </div>
  );
}