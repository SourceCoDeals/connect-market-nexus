import React, { useState } from 'react';
import { EnhancedDealsKanbanBoard } from '@/components/admin/EnhancedDealsKanbanBoard';
import { DealDetailModal } from '@/components/admin/DealDetailModal';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';
import { Deal } from '@/hooks/admin/use-deals';

export default function AdminPipeline() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDealDetailOpen, setIsDealDetailOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EnhancedDealsKanbanBoard 
        onCreateDeal={handleCreateDeal}
        onManageStages={handleManageStages}
        onDealClick={handleDealClick}
      />

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