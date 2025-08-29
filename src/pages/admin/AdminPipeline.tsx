import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedDealsKanbanBoard } from '@/components/admin/EnhancedDealsKanbanBoard';
import { DealsListView } from '@/components/admin/DealsListView';
import { DealDetailModal } from '@/components/admin/DealDetailModal';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';
import { Deal, useDeals } from '@/hooks/admin/use-deals';
import { LayoutDashboard, List } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* View Switcher */}
            <Tabs defaultValue="kanban" className="w-full">
              <div className="flex items-center justify-between">
                <TabsList className="bg-gray-100 p-1 rounded-lg">
                  <TabsTrigger 
                    value="kanban" 
                    className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    Kanban
                  </TabsTrigger>
                  <TabsTrigger 
                    value="list" 
                    className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                  >
                    List
                  </TabsTrigger>
                </TabsList>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleManageStages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Manage Stages
                  </button>
                  <button
                    onClick={handleCreateDeal}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors duration-200"
                  >
                    Create Deal
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="mt-6">
                <TabsContent value="kanban" className="space-y-0 m-0">
                  <EnhancedDealsKanbanBoard 
                    onCreateDeal={handleCreateDeal}
                    onManageStages={handleManageStages}
                    onDealClick={handleDealClick}
                  />
                </TabsContent>
                
                <TabsContent value="list" className="space-y-0 m-0">
                  <DealsListView 
                    onDealClick={handleDealClick}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Modals */}
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