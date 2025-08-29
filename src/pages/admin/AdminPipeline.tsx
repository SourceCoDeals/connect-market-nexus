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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* HubSpot-style Header */}
      <div className="bg-background border-b border-border/30 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Title + View Tabs */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-foreground">Deals</h1>
            <Tabs defaultValue="kanban" className="h-8">
              <TabsList className="h-8 p-0.5 bg-muted/50">
                <TabsTrigger 
                  value="kanban" 
                  className="h-7 px-3 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                  Board
                </TabsTrigger>
                <TabsTrigger 
                  value="list" 
                  className="h-7 px-3 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <List className="h-3.5 w-3.5 mr-1.5" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageStages}
              className="h-8 text-sm font-medium"
            >
              Manage stages
            </Button>
            <Button
              onClick={handleCreateDeal}
              size="sm"
              className="h-8 text-sm font-medium"
            >
              Create deal
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area - Full Height */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="kanban" className="h-full flex flex-col">
          <TabsContent value="kanban" className="flex-1 m-0 overflow-hidden">
            <EnhancedDealsKanbanBoard 
              onCreateDeal={handleCreateDeal}
              onManageStages={handleManageStages}
              onDealClick={handleDealClick}
            />
          </TabsContent>
          
          <TabsContent value="list" className="flex-1 m-0 overflow-hidden">
            <DealsListView 
              onDealClick={handleDealClick}
            />
          </TabsContent>
        </Tabs>
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