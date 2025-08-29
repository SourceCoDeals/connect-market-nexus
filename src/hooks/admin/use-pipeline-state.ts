import { useState } from 'react';
import { Deal } from '@/hooks/admin/use-deals';

export type ViewMode = 'kanban' | 'list' | 'table';

export interface PipelineFilters {
  search: string;
  stage: string;
  owner: string;
  priority: string;
  source: string;
  dateRange: [Date | null, Date | null];
  dealValue: [number, number];
  buyerType: string;
  status: string;
}

export const usePipelineState = () => {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false);
  
  const [filters, setFilters] = useState<PipelineFilters>({
    search: '',
    stage: 'all',
    owner: 'all',
    priority: 'all',
    source: 'all',
    dateRange: [null, null],
    dealValue: [0, 10000000],
    buyerType: 'all',
    status: 'all'
  });

  return {
    selectedDeal,
    setSelectedDeal,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    isCreateDealOpen,
    setIsCreateDealOpen,
    isStageManagementOpen,
    setIsStageManagementOpen,
    isMetricsCollapsed,
    setIsMetricsCollapsed
  };
};