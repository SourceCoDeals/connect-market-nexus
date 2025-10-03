import React, { useState } from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineHeader } from './PipelineHeader';
import { PipelineWorkspace } from './PipelineWorkspace';
import { PipelineDetailPanel } from './PipelineDetailPanel';
import { PipelineFilterPanel } from './PipelineFilterPanel';
import { ActiveFilterChips } from './ActiveFilterChips';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';



export function PipelineShell() {
  const pipeline = usePipelineCore();
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [prefilledStageId, setPrefilledStageId] = useState<string | undefined>(undefined);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);

  const handleOpenCreateDeal = (stageId?: string) => {
    setPrefilledStageId(stageId);
    setIsCreateDealModalOpen(true);
  };

  const handleDealCreated = (dealId: string) => {
    // Auto-select the newly created deal to open its detail panel
    const createdDeal = pipeline.deals.find(d => d.deal_id === dealId);
    if (createdDeal) {
      pipeline.setSelectedDeal(createdDeal);
    } else {
      // If not found immediately (due to query timing), wait a bit and try again
      setTimeout(() => {
        const deal = pipeline.deals.find(d => d.deal_id === dealId);
        if (deal) pipeline.setSelectedDeal(deal);
      }, 500);
    }
  };

  // Listen for stage management open event
  React.useEffect(() => {
    const handleOpenStageManagement = () => {
      setIsStageManagementOpen(true);
    };
    window.addEventListener('open-stage-management', handleOpenStageManagement);
    return () => {
      window.removeEventListener('open-stage-management', handleOpenStageManagement);
    };
  }, []);
  
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
            "header"
            "workspace";
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
          height: 100vh;
          background: hsl(var(--background));
          position: relative;
        }
        
        @media (max-width: 1024px) {
          .pipeline-shell {
            grid-template-areas: 
              "header"
              "workspace";
            grid-template-columns: 1fr;
          }
        }
        
        .pipeline-header { grid-area: header; }
        .pipeline-workspace { grid-area: workspace; }
        .pipeline-detail { grid-area: detail; }
      `}</style>
      
      {/* Header */}
      <div className="pipeline-header">
        <PipelineHeader 
          pipeline={pipeline}
          onOpenCreateDeal={() => handleOpenCreateDeal()}
        />
        {/* Active Filter Chips */}
        <ActiveFilterChips pipeline={pipeline} />
      </div>

      {/* Main Workspace */}
      <div className="pipeline-workspace">
        <PipelineWorkspace 
          pipeline={pipeline}
          onOpenCreateDeal={handleOpenCreateDeal}
        />
      </div>
      
      {/* Backdrop Overlay */}
      {(!pipeline.isMobile && pipeline.selectedDeal) && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
          onClick={() => pipeline.setSelectedDeal(null)}
        />
      )}
      
      {/* Detail Panel */}
      {(!pipeline.isMobile && pipeline.selectedDeal) && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex justify-end">
          <PipelineDetailPanel pipeline={pipeline} />
        </div>
      )}
      
      {/* Filter Panel Overlay */}
      <PipelineFilterPanel pipeline={pipeline} />

      {/* Create Deal Modal */}
      <CreateDealModal 
        open={isCreateDealModalOpen}
        onOpenChange={setIsCreateDealModalOpen}
        prefilledStageId={prefilledStageId}
        onDealCreated={handleDealCreated}
      />

      {/* Stage Management Modal */}
      <StageManagementModal
        open={isStageManagementOpen}
        onOpenChange={setIsStageManagementOpen}
      />
    </div>
  );
}