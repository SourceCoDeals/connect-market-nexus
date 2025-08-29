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
    <div className="space-y-8">
      <div className="border-b border-border/50 pb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2">
          Deals Pipeline
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your deals through the sales pipeline
        </p>
      </div>

      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList className="bg-muted/30 backdrop-blur-sm p-1 rounded-xl shadow-sm border border-border/50">
          <TabsTrigger 
            value="kanban" 
            className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
          >
            <LayoutDashboard className="h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger 
            value="list" 
            className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
          >
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <EnhancedDealsKanbanBoard 
            onCreateDeal={handleCreateDeal}
            onManageStages={handleManageStages}
            onDealClick={handleDealClick}
          />
        </TabsContent>
        
        <TabsContent value="list">
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