import React, { useState, useMemo } from 'react';
import { EnhancedDealsKanbanBoard } from '@/components/admin/EnhancedDealsKanbanBoard';
import { DealsListView } from '@/components/admin/DealsListView';
import { DealDetailModal } from '@/components/admin/DealDetailModal';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';
import { MinimalTopBar } from '@/components/admin/MinimalTopBar';
import { Deal, useDeals } from '@/hooks/admin/use-deals';

export default function AdminPipeline() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDealDetailOpen, setIsDealDetailOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban');

  const { data: deals } = useDeals();

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsDealDetailOpen(true);
  };

  const handleCreateDeal = () => {
    setIsCreateDealOpen(true);
  };

  const handleManageStages = () => {
    setIsStageManagementOpen(true);
  };

  // Calculate metrics for top bar
  const metrics = useMemo(() => {
    if (!deals) return { totalDeals: 0, totalValue: '$0' };
    
    const totalValue = deals.reduce((sum, deal) => sum + deal.deal_value, 0);
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };
    
    return {
      totalDeals: deals.length,
      totalValue: formatCurrency(totalValue),
    };
  }, [deals]);

  return (
    <div className="h-screen flex flex-col">
      {/* Minimal Top Bar */}
      <MinimalTopBar
        currentView={currentView}
        onViewChange={setCurrentView}
        onCreateDeal={handleCreateDeal}
        onManageStages={handleManageStages}
        dealCount={metrics.totalDeals}
        totalValue={metrics.totalValue}
      />

      {/* Full Screen Content */}
      <div className="flex-1">
        {currentView === 'kanban' ? (
          <EnhancedDealsKanbanBoard 
            onCreateDeal={handleCreateDeal}
            onManageStages={handleManageStages}
            onDealClick={handleDealClick}
          />
        ) : (
          <DealsListView 
            onDealClick={handleDealClick}
          />
        )}
      </div>

      <DealDetailModal
        deal={selectedDeal}
        open={isDealDetailOpen}
        onOpenChange={setIsDealDetailOpen}
      />

      <CreateDealModal
        open={isCreateDealOpen}
        onOpenChange={setIsCreateDealOpen}
      />

      <StageManagementModal
        open={isStageManagementOpen}
        onOpenChange={setIsStageManagementOpen}
      />
    </div>
  );
}