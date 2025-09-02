import { useState, useMemo } from 'react';
import { 
  useConnectionRequestPipeline, 
  useConnectionRequestStages,
  type ConnectionRequestPipelineItem,
  type ConnectionRequestStage
} from './use-connection-request-pipeline';

export type ViewMode = 'kanban' | 'list' | 'table';

export interface PipelineMetrics {
  totalRequests: number;
  totalValue: number;
  conversionRate: number;
  avgTimeInPipeline: number;
  documentsCompleted: number;
  pendingDocuments: number;
  qualifiedBuyers: number;
}

export interface StageWithMetrics extends ConnectionRequestStage {
  requestCount: number;
  totalValue: number;
  avgPriorityScore: number;
  documentsCompleteCount: number;
}

export interface PipelineFilters {
  search: string;
  buyerType: string;
  priority: string;
  documentStatus: string;
  source: string;
  listingId?: string;
}

/**
 * Core hook for managing connection request pipeline state and logic
 */
export function useConnectionRequestPipelineCore(listingId?: string) {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [showMetrics, setShowMetrics] = useState(true);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<PipelineFilters>({
    search: '',
    buyerType: '',
    priority: '',
    documentStatus: '',
    source: '',
    listingId,
  });

  // Data fetching
  const { 
    data: requests = [], 
    isLoading: requestsLoading,
    error: requestsError 
  } = useConnectionRequestPipeline(listingId);
  
  const { 
    data: stages = [], 
    isLoading: stagesLoading,
    error: stagesError 
  } = useConnectionRequestStages();

  // Filter requests based on current filters
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesUser = request.user?.first_name?.toLowerCase().includes(searchLower) ||
                           request.user?.last_name?.toLowerCase().includes(searchLower) ||
                           request.user?.email?.toLowerCase().includes(searchLower) ||
                           request.user?.company?.toLowerCase().includes(searchLower);
        const matchesListing = request.listing?.title?.toLowerCase().includes(searchLower) ||
                              request.listing?.deal_identifier?.toLowerCase().includes(searchLower);
        
        if (!matchesUser && !matchesListing) return false;
      }

      // Buyer type filter
      if (filters.buyerType && request.user?.buyer_type !== filters.buyerType) {
        return false;
      }

      // Priority filter
      if (filters.priority) {
        const priority = parseInt(filters.priority);
        if (request.buyer_priority_score !== priority) return false;
      }

      // Document status filter
      if (filters.documentStatus) {
        const hasNDA = request.user?.nda_signed || false;
        const hasFee = request.user?.fee_agreement_signed || false;
        
        switch (filters.documentStatus) {
          case 'complete':
            if (!hasNDA || !hasFee) return false;
            break;
          case 'pending':
            if (hasNDA && hasFee) return false;
            break;
          case 'nda_only':
            if (!hasNDA || hasFee) return false;
            break;
          case 'fee_only':
            if (hasNDA || !hasFee) return false;
            break;
        }
      }

      // Source filter
      if (filters.source && request.source !== filters.source) {
        return false;
      }

      return true;
    });
  }, [requests, filters]);

  // Group filtered requests by stage
  const requestsByStage = useMemo(() => {
    const grouped = new Map<string, ConnectionRequestPipelineItem[]>();
    
    // Initialize all stages
    stages.forEach(stage => {
      grouped.set(stage.id, []);
    });

    // Group requests by stage
    filteredRequests.forEach(request => {
      const stageId = request.pipeline_stage_id;
      if (stageId && grouped.has(stageId)) {
        grouped.get(stageId)!.push(request);
      }
    });

    // Sort requests within each stage by priority score (descending) then by created date
    grouped.forEach(requests => {
      requests.sort((a, b) => {
        if (a.buyer_priority_score !== b.buyer_priority_score) {
          return b.buyer_priority_score - a.buyer_priority_score;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });

    return grouped;
  }, [filteredRequests, stages]);

  // Calculate overall metrics
  const metrics = useMemo((): PipelineMetrics => {
    const totalRequests = filteredRequests.length;
    const documentsCompleted = filteredRequests.filter(r => 
      r.user?.nda_signed && r.user?.fee_agreement_signed
    ).length;
    const pendingDocuments = totalRequests - documentsCompleted;
    const qualifiedBuyers = filteredRequests.filter(r => 
      r.buyer_priority_score >= 3
    ).length;

    // Calculate total value (using listing revenue as proxy)
    const totalValue = filteredRequests.reduce((sum, request) => {
      return sum + (request.listing?.revenue || 0);
    }, 0);

    // Calculate conversion rate (requests that reached LOI or won stages)
    const convertedRequests = filteredRequests.filter(r => {
      const stageName = r.stage?.name?.toLowerCase();
      return stageName?.includes('loi') || stageName?.includes('won');
    }).length;
    const conversionRate = totalRequests > 0 ? (convertedRequests / totalRequests) * 100 : 0;

    // Calculate average time in pipeline (placeholder - would need more detailed tracking)
    const avgTimeInPipeline = 0; // TODO: Implement based on stage_entered_at tracking

    return {
      totalRequests,
      totalValue,
      conversionRate,
      avgTimeInPipeline,
      documentsCompleted,
      pendingDocuments,
      qualifiedBuyers,
    };
  }, [filteredRequests]);

  // Calculate stage-specific metrics
  const stageMetrics = useMemo((): StageWithMetrics[] => {
    return stages.map(stage => {
      const stageRequests = requestsByStage.get(stage.id) || [];
      const requestCount = stageRequests.length;
      
      const totalValue = stageRequests.reduce((sum, request) => {
        return sum + (request.listing?.revenue || 0);
      }, 0);

      const avgPriorityScore = requestCount > 0 
        ? stageRequests.reduce((sum, r) => sum + r.buyer_priority_score, 0) / requestCount
        : 0;

      const documentsCompleteCount = stageRequests.filter(r => 
        r.user?.nda_signed && r.user?.fee_agreement_signed
      ).length;

      return {
        ...stage,
        requestCount,
        totalValue,
        avgPriorityScore,
        documentsCompleteCount,
      };
    });
  }, [stages, requestsByStage]);

  // Actions
  const handleRequestSelect = (requestId: string) => {
    setSelectedRequest(selectedRequest === requestId ? null : requestId);
  };

  const handleMultiSelect = (requestId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedRequests);
    if (isSelected) {
      newSelected.add(requestId);
    } else {
      newSelected.delete(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const toggleMetrics = () => setShowMetrics(!showMetrics);
  const toggleMetricsCollapse = () => setMetricsCollapsed(!metricsCollapsed);
  const toggleSidebar = () => setShowSidebar(!showSidebar);

  const updateFilter = (key: keyof PipelineFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      buyerType: '',
      priority: '',
      documentStatus: '',
      source: '',
      listingId,
    });
  };

  return {
    // State
    viewMode,
    selectedRequest,
    selectedRequests,
    showMetrics,
    metricsCollapsed,
    showSidebar,
    filters,

    // Data
    requests: filteredRequests,
    stages,
    requestsByStage,
    metrics,
    stageMetrics,
    
    // Loading states
    isLoading: requestsLoading || stagesLoading,
    error: requestsError || stagesError,

    // Actions
    setViewMode,
    handleRequestSelect,
    handleMultiSelect,
    toggleMetrics,
    toggleMetricsCollapse,
    toggleSidebar,
    updateFilter,
    clearFilters,
  };
}