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
import { BulkDealImportDialog } from '@/components/admin/BulkDealImportDialog';
import { ManualUndoImportDialog } from '@/components/admin/ManualUndoImportDialog';
import { useBulkDealImport } from '@/hooks/admin/use-bulk-deal-import';
import { useNotificationEmailSender } from '@/hooks/admin/use-notification-email-sender';
import { useDealOwnerNotifications } from '@/hooks/admin/use-deal-owner-notifications';



export function PipelineShell() {
  const pipeline = usePipelineCore();
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [prefilledStageId, setPrefilledStageId] = useState<string | undefined>(undefined);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isUndoImportOpen, setIsUndoImportOpen] = useState(false);
  const { bulkImport, isLoading: isBulkImporting } = useBulkDealImport();
  
  // Automatically send emails for pending notifications
  useNotificationEmailSender();
  
  // Listen for deal owner assignment/reassignment and send email notifications
  useDealOwnerNotifications();

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

  const handleBulkImport = async (data: any) => {
    try {
      const result = await bulkImport(data);
      // Only close if there are NO duplicates to resolve
      // The dialog will stay open if there are duplicates to handle
      if (result && result.details.duplicates.length === 0) {
        setIsBulkImportOpen(false);
      }
      return result;
    } catch (error) {
      console.error('Bulk import error:', error);
      return undefined;
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

  // Listen for notification clicks to open deals
  React.useEffect(() => {
    const handleOpenDealFromNotification = (event: CustomEvent) => {
      const { dealId, tab } = event.detail;
      console.log('[PipelineShell] Opening deal from notification:', { dealId, tab });
      
      if (dealId) {
        // Find the deal
        const deal = pipeline.deals.find(d => d.deal_id === dealId);
        if (deal) {
          pipeline.setSelectedDeal(deal);
          
          // If tab is specified, set it in the detail panel (via URL params handled by detail panel)
          if (tab) {
            console.log('[PipelineShell] Tab specified:', tab);
          }
        } else {
          console.warn('[PipelineShell] Deal not found:', dealId);
        }
      }
    };

    window.addEventListener('open-deal-from-notification', handleOpenDealFromNotification as EventListener);
    return () => {
      window.removeEventListener('open-deal-from-notification', handleOpenDealFromNotification as EventListener);
    };
  }, [pipeline.deals, pipeline.setSelectedDeal]);

  // Check URL params on mount for deep linking from notifications
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dealId = urlParams.get('deal');
    const tab = urlParams.get('tab');
    
    if (dealId && pipeline.deals.length > 0) {
      console.log('[PipelineShell] Opening deal from URL params:', { dealId, tab });
      const deal = pipeline.deals.find(d => d.deal_id === dealId);
      if (deal) {
        pipeline.setSelectedDeal(deal);
      }
    }
  }, [pipeline.deals]);
  
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
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
          onOpenUndoImport={() => setIsUndoImportOpen(true)}
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

      {/* Bulk Import Modal */}
      <BulkDealImportDialog
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onConfirm={handleBulkImport}
        isLoading={isBulkImporting}
      />

      {/* Manual Undo Import Modal */}
      <ManualUndoImportDialog
        isOpen={isUndoImportOpen}
        onClose={() => setIsUndoImportOpen(false)}
      />
    </div>
  );
}