import { useState, useMemo } from 'react';
import { useDeals, useDealStages, Deal } from '@/hooks/admin/use-deals';
import { useDealFilters } from '@/hooks/admin/use-deal-filters';
import { useIsMobile } from '@/hooks/use-mobile';

export type ViewMode = 'kanban' | 'list' | 'table';

export interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  avgProbability: number;
  pendingTasks: number;
  conversionRate: number;
  avgDaysInStage: number;
}

export function usePipelineCore() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  
  
  const isMobile = useIsMobile();
  
  // Data fetching
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: stages, isLoading: stagesLoading } = useDealStages();
  
  // Filtering
  const filterHook = useDealFilters(deals || []);
  const { filteredAndSortedDeals } = filterHook;
  
  // Group deals by stage
  const dealsByStage = useMemo(() => {
    if (!filteredAndSortedDeals || !stages) return {};
    
    return stages.reduce((acc, stage) => {
      acc[stage.id] = filteredAndSortedDeals.filter(deal => deal.stage_id === stage.id);
      return acc;
    }, {} as Record<string, Deal[]>);
  }, [filteredAndSortedDeals, stages]);
  
  // Calculate metrics
  const metrics = useMemo((): PipelineMetrics => {
    if (!filteredAndSortedDeals) {
      return {
        totalDeals: 0,
        totalValue: 0,
        avgProbability: 0,
        pendingTasks: 0,
        conversionRate: 0,
        avgDaysInStage: 0,
      };
    }
    
    const totalValue = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
    const avgProbability = filteredAndSortedDeals.length > 0 
      ? filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / filteredAndSortedDeals.length 
      : 0;
    const pendingTasks = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.pending_tasks, 0);
    
    // Calculate conversion rate (deals in final stages)
    const finalStageDeals = filteredAndSortedDeals.filter(deal => 
      deal.stage_name.toLowerCase().includes('closed') || 
      deal.stage_name.toLowerCase().includes('won')
    );
    const conversionRate = filteredAndSortedDeals.length > 0 
      ? (finalStageDeals.length / filteredAndSortedDeals.length) * 100 
      : 0;
    
    // Calculate average days in current stage
    const avgDaysInStage = filteredAndSortedDeals.length > 0
      ? filteredAndSortedDeals.reduce((sum, deal) => {
          const stageEnteredAt = new Date(deal.deal_stage_entered_at);
          const now = new Date();
          const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysInStage;
        }, 0) / filteredAndSortedDeals.length
      : 0;
    
    return {
      totalDeals: filteredAndSortedDeals.length,
      totalValue,
      avgProbability,
      pendingTasks,
      conversionRate,
      avgDaysInStage,
    };
  }, [filteredAndSortedDeals]);
  
  // Stage metrics
  const stageMetrics = useMemo(() => {
    if (!stages || !dealsByStage) return [];
    
    return stages.map(stage => {
      const stageDeals = dealsByStage[stage.id] || [];
      const totalValue = stageDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
      const avgProbability = stageDeals.length > 0 
        ? stageDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / stageDeals.length 
        : 0;
      
      return {
        ...stage,
        dealCount: stageDeals.length,
        totalValue,
        avgProbability,
        deals: stageDeals,
      };
    });
  }, [stages, dealsByStage]);
  
  // Actions
  const handleDealSelect = (deal: Deal) => {
    setSelectedDeal(deal);
    if (isMobile) {
      setIsDetailPanelOpen(true);
    }
  };
  
  const handleMultiSelect = (dealIds: string[]) => {
    setSelectedDeals(dealIds);
  };
  
  const toggleDetailPanel = () => {
    setIsDetailPanelOpen(!isDetailPanelOpen);
  };
  
  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(!isFilterPanelOpen);
  };
  
  
  return {
    // State
    viewMode,
    selectedDeal,
    selectedDeals,
    isDetailPanelOpen,
    isFilterPanelOpen,
    
    isMobile,
    
    // Data
    deals: filteredAndSortedDeals || [],
    stages: stages || [],
    dealsByStage,
    metrics,
    stageMetrics,
    isLoading: dealsLoading || stagesLoading,
    
    // Filters
    ...filterHook,
    
    // Actions
    setViewMode,
    setSelectedDeal,
    setSelectedDeals,
    setIsDetailPanelOpen,
    setIsFilterPanelOpen,
    
    handleDealSelect,
    handleMultiSelect,
    toggleDetailPanel,
    toggleFilterPanel,
    
  };
}