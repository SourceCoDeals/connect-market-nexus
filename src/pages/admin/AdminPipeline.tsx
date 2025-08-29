import React, { useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
    <div className="h-screen flex flex-col">
      <MinimalTopBar 
        onCreateDeal={handleCreateDeal}
        onManageStages={handleManageStages}
      />
      
      <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
        <TabsContent value="kanban" className="flex-1 m-0">
          <EnhancedDealsKanbanBoard 
            onCreateDeal={handleCreateDeal}
            onManageStages={handleManageStages}
            onDealClick={handleDealClick}
          />
        </TabsContent>
        
        <TabsContent value="list" className="flex-1 m-0">
          <DealsListView 
            onDealClick={handleDealClick}
          />
        </TabsContent>
      </Tabs>

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