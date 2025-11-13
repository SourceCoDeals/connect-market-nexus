import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverlay, closestCorners } from '@dnd-kit/core';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { useUpdateDealStage } from '@/hooks/admin/use-deals';
import { PipelineKanbanColumn } from './PipelineKanbanColumn';
import { PipelineKanbanCardOverlay } from './PipelineKanbanCardOverlay';
import { DealOwnerWarningDialog } from '@/components/admin/DealOwnerWarningDialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PipelineKanbanViewProps {
  pipeline: ReturnType<typeof usePipelineCore>;
  onOpenCreateDeal?: (stageId?: string) => void;
}

export function PipelineKanbanView({ pipeline, onOpenCreateDeal }: PipelineKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [ownerWarning, setOwnerWarning] = useState<{ show: boolean; ownerName: string; dealTitle: string; dealId: string; stageId: string; } | null>(null);
  const updateDealStage = useUpdateDealStage();
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  
  // Transform stages to include metrics
  const stagesWithMetrics = useMemo(() => {
    return pipeline.stages.map(stage => {
      const stageDeals = pipeline.deals.filter(d => d.stage_id === stage.id);
      return {
        ...stage,
        dealCount: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0),
        avgProbability: stageDeals.length > 0 
          ? stageDeals.reduce((sum, d) => sum + (d.deal_probability || 0), 0) / stageDeals.length 
          : 0,
        deals: stageDeals
      };
    });
  }, [pipeline.stages, pipeline.deals]);
  
  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const handleDragOver = (event: DragOverEvent) => {};
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = String(active?.id ?? '');
    const overIdStr = String(over?.id ?? '');

    if (!over || !pipeline.deals) {
      setActiveId(null);
      return;
    }

    const dealId = activeIdStr.startsWith('deal:') ? activeIdStr.slice(5) : activeIdStr;
    let destStageId: string | null = null;
    
    if (overIdStr.startsWith('stage:')) {
      destStageId = overIdStr.slice(6);
    } else if (overIdStr.startsWith('deal:')) {
      const overDeal = pipeline.deals.find(d => d.deal_id === overIdStr.slice(5));
      destStageId = overDeal?.stage_id || null;
    }

    if (!destStageId) { setActiveId(null); return; }

    const deal = pipeline.deals.find(d => d.deal_id === dealId);
    const targetStage = pipeline.stages.find(s => s.id === destStageId);

    if (!deal || !targetStage || deal.stage_id === destStageId) { setActiveId(null); return; }

    updateDealStage.mutate(
      { dealId, stageId: destStageId, fromStage: deal.stage_name || undefined, toStage: targetStage.name, currentAdminId: currentUserId, skipOwnerCheck: false },
      { onError: (error: any) => { if (error?.type === 'OWNER_WARNING') setOwnerWarning({ show: true, ownerName: error.ownerName, dealTitle: error.dealTitle, dealId: error.dealId, stageId: error.stageId }); } }
    );
    setActiveId(null);
  };

  const handleOwnerWarningConfirm = () => {
    if (!ownerWarning) return;
    
    const deal = pipeline.deals.find(d => d.deal_id === ownerWarning.dealId);
    const targetStage = stagesWithMetrics.find(s => s.id === ownerWarning.stageId);
    
    if (!deal || !targetStage) {
      console.error('[Owner Warning] Deal or stage not found', { dealId: ownerWarning.dealId, stageId: ownerWarning.stageId });
      setOwnerWarning(null);
      return;
    }
    
    updateDealStage.mutate({
      dealId: ownerWarning.dealId,
      stageId: ownerWarning.stageId,
      fromStage: deal.stage_name || undefined,
      toStage: targetStage.name || undefined,
      currentAdminId: currentUserId,
      skipOwnerCheck: true
    });
    
    setOwnerWarning(null);
  };
  
  const scrollToStage = (direction: 'left' | 'right') => {
    const container = document.getElementById('kanban-scroll-container');
    if (container) {
      const newPosition = scrollPosition + (direction === 'left' ? -320 : 320);
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const activeDeal = activeId ? pipeline.deals.find(d => `deal:${d.deal_id}` === activeId) : null;

  return (
    <>
      <div className="h-full flex flex-col">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex-1 relative overflow-hidden">
            <div className="md:hidden absolute top-2 right-2 z-20 flex gap-1 bg-background/95 backdrop-blur-sm rounded-lg p-1 shadow-lg">
              <Button variant="outline" size="sm" onClick={() => scrollToStage('left')} className="h-7 w-7 p-0"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" onClick={() => scrollToStage('right')} className="h-7 w-7 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
            <div id="kanban-scroll-container" className="absolute inset-0 overflow-x-auto overflow-y-hidden" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
              <div className="flex gap-4 p-4 h-full min-w-min" style={{ minHeight: '600px' }}>
                {stagesWithMetrics.map((stage) => (
                  <PipelineKanbanColumn key={stage.id} stage={stage} deals={stage.deals} onDealClick={(deal) => {}} onOpenCreateDeal={onOpenCreateDeal} totalStages={pipeline.stages.length} />
                ))}
              </div>
            </div>
          </div>
          <DragOverlay>{activeDeal ? <PipelineKanbanCardOverlay deal={activeDeal} /> : null}</DragOverlay>
        </DndContext>
      </div>
      {ownerWarning && <DealOwnerWarningDialog open={ownerWarning.show} onOpenChange={(open) => !open && setOwnerWarning(null)} ownerName={ownerWarning.ownerName} dealTitle={ownerWarning.dealTitle} onConfirm={handleOwnerWarningConfirm} />}
    </>
  );
}
