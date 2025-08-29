import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
    <div className="min-h-screen w-full">
      <div className="w-full px-6 py-8 space-y-8">
        <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Clean Header Bar */}
        <div className="flex items-center justify-between py-4 border-b border-border/50">
          {/* View Switcher - Left Side */}
          <Tabs defaultValue="kanban" className="w-auto">
            <TabsList className="bg-background border border-border/50 shadow-sm p-1 h-11">
              <TabsTrigger 
                value="kanban" 
                className="px-6 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200"
              >
                Kanban
              </TabsTrigger>
              <TabsTrigger 
                value="list" 
                className="px-6 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200"
              >
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Action Buttons - Right Side */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleManageStages}
              className="h-11 px-6 text-sm font-medium border-border/50 hover:bg-accent/50 transition-all duration-200"
            >
              Manage Stages
            </Button>
            <Button 
              onClick={handleCreateDeal}
              className="h-11 px-6 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-200"
            >
              Create Deal
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <Tabs defaultValue="kanban" className="space-y-0">
          <TabsContent value="kanban" className="mt-0">
            <EnhancedDealsKanbanBoard 
              onCreateDeal={handleCreateDeal}
              onManageStages={handleManageStages}
              onDealClick={handleDealClick}
            />
          </TabsContent>
          
          <TabsContent value="list" className="mt-0">
            <DealsListView 
              onDealClick={handleDealClick}
            />
          </TabsContent>
        </Tabs>
        </div>
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