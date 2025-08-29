import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DealsKanbanBoard } from '@/components/admin/DealsKanbanBoard';
import { DealsPipelineView } from "@/components/admin/DealsPipelineView";
import { DealDetailModal } from '@/components/admin/DealDetailModal';
import { Deal } from '@/hooks/admin/use-deals';
import { Kanban, List } from 'lucide-react';

const AdminPipeline = () => {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'kanban' | 'list'>('kanban');

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setDealModalOpen(true);
  };

  const handleCreateDeal = () => {
    // TODO: Implement create deal functionality
    console.log('Create deal');
  };

  const handleManageStages = () => {
    // TODO: Implement stage management
    console.log('Manage stages');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-muted-foreground">Comprehensive deal management and sales pipeline</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('kanban')}
          >
            <Kanban className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={activeView === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List View
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'kanban' | 'list')}>
        <TabsContent value="kanban">
          <DealsKanbanBoard
            onCreateDeal={handleCreateDeal}
            onManageStages={handleManageStages}
            onDealClick={handleDealClick}
          />
        </TabsContent>
        
        <TabsContent value="list">
          <DealsPipelineView />
        </TabsContent>
      </Tabs>

      <DealDetailModal
        deal={selectedDeal}
        open={dealModalOpen}
        onOpenChange={setDealModalOpen}
      />
    </div>
  );
};

export default AdminPipeline;