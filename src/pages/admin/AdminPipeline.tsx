import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DealsKanbanBoard } from '@/components/admin/DealsKanbanBoard';
import { DealsListView } from '@/components/admin/DealsListView';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { WorkflowAutomation } from '@/components/admin/WorkflowAutomation';
import { BulkDealOperations } from '@/components/admin/BulkDealOperations';
import { DealDetailModal } from '@/components/admin/DealDetailModal';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';
import { Deal, useDeals } from '@/hooks/admin/use-deals';
import { LayoutDashboard, List, BarChart3, Zap, Users } from 'lucide-react';

export default function AdminPipeline() {
  const { data: deals } = useDeals();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-muted-foreground">Comprehensive deal management and sales pipeline</p>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Bulk Ops
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <DealsKanbanBoard 
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

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="automation">
          <WorkflowAutomation />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkDealOperations 
            deals={deals || []}
            onRefresh={() => {
              // Refresh deals data
            }}
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