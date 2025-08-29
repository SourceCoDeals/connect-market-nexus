import React, { useState } from 'react';
import { PipelineHeader } from '@/components/admin/pipeline/PipelineHeader';
import { PipelineMetrics } from '@/components/admin/pipeline/PipelineMetrics';
import { PipelineCanvas } from '@/components/admin/pipeline/PipelineCanvas';
import { PipelineDetailPanel } from '@/components/admin/pipeline/PipelineDetailPanel';
import { usePipelineState } from '@/hooks/admin/use-pipeline-state';
import { Deal } from '@/hooks/admin/use-deals';

export default function AdminPipeline() {
  const {
    selectedDeal,
    setSelectedDeal,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    isCreateDealOpen,
    setIsCreateDealOpen,
    isStageManagementOpen,
    setIsStageManagementOpen,
    isMetricsCollapsed,
    setIsMetricsCollapsed
  } = usePipelineState();

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsDetailPanelOpen(true);
  };

  const handleCreateDeal = () => {
    setIsCreateDealOpen(true);
  };

  const handleManageStages = () => {
    setIsStageManagementOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* Global Header - Sticky */}
      <PipelineHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filters={filters}
        onFiltersChange={setFilters}
        onCreateDeal={handleCreateDeal}
        onManageStages={handleManageStages}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Primary Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Stats Bar - Collapsible */}
          <PipelineMetrics
            isCollapsed={isMetricsCollapsed}
            onToggleCollapse={() => setIsMetricsCollapsed(!isMetricsCollapsed)}
          />

          {/* Pipeline Canvas */}
          <PipelineCanvas
            viewMode={viewMode}
            filters={filters}
            onDealClick={handleDealClick}
            onCreateDeal={handleCreateDeal}
            onManageStages={handleManageStages}
            selectedDeal={selectedDeal}
          />
        </div>

        {/* Detail Panel - Slide-in */}
        <PipelineDetailPanel
          deal={selectedDeal}
          isOpen={isDetailPanelOpen}
          onClose={() => setIsDetailPanelOpen(false)}
        />
      </div>
    </div>
  );
}