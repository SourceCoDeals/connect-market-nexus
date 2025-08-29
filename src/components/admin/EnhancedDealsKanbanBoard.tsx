import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Search, CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';
import { useDeals, useDealStages, useUpdateDealStage, Deal } from '@/hooks/admin/use-deals';
import { useDealFilters } from '@/hooks/admin/use-deal-filters';
import { DealKanbanColumn } from './DealKanbanColumn';
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface EnhancedDealsKanbanBoardProps {
  onCreateDeal?: () => void;
  onManageStages?: () => void;
  onDealClick?: (deal: Deal) => void;
}

export function EnhancedDealsKanbanBoard({ onCreateDeal, onManageStages, onDealClick }: EnhancedDealsKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: stages, isLoading: stagesLoading } = useDealStages();
  const updateDealStage = useUpdateDealStage();

  const {
    searchQuery,
    statusFilter,
    buyerTypeFilter,
    listingFilter,
    adminFilter,
    documentStatusFilter,
    sortOption,
    filteredAndSortedDeals,
    setSearchQuery,
    setStatusFilter,
    setBuyerTypeFilter,
    setListingFilter,
    setAdminFilter,
    setDocumentStatusFilter,
    setSortOption,
  } = useDealFilters(deals || []);

  // Create status options with counts and icons
  const statusOptions = useMemo(() => {
    if (!deals) return [];
    return [
      {
        value: 'new_inquiry',
        label: 'New Inquiry',
        icon: Users,
        count: deals.filter(d => d.stage_name === 'New Inquiry').length
      },
      {
        value: 'qualified',
        label: 'Qualified',
        icon: CheckCircle2,
        count: deals.filter(d => d.stage_name === 'Qualified').length
      },
      {
        value: 'due_diligence',
        label: 'Due Diligence',
        icon: Clock,
        count: deals.filter(d => d.stage_name === 'Due Diligence').length
      },
      {
        value: 'under_contract',
        label: 'Under Contract',
        icon: AlertCircle,
        count: deals.filter(d => d.stage_name === 'Under Contract').length
      }
    ];
  }, [deals]);

  // Create listing options
  const listingOptions = useMemo(() => {
    if (!deals) return [];
    const uniqueListings = Array.from(new Set(deals.map(d => ({ id: d.listing_id, title: d.listing_title })).filter(l => l.id)));
    return uniqueListings.map(listing => ({
      value: listing.id,
      label: listing.title || 'Untitled Listing'
    }));
  }, [deals]);

  // Create admin options
  const adminOptions = useMemo(() => {
    if (!deals) return [];
    const uniqueAdmins = Array.from(new Set(deals.map(d => d.assigned_to).filter(a => a)));
    return [
      { value: 'unassigned', label: 'Unassigned' },
      ...uniqueAdmins.map(admin => ({ value: admin, label: admin }))
    ];
  }, [deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group filtered deals by stage
  const dealsByStage = useMemo(() => {
    if (!filteredAndSortedDeals || !stages) return {};
    
    const grouped = stages.reduce((acc, stage) => {
      acc[stage.id] = filteredAndSortedDeals.filter(deal => deal.stage_id === stage.id);
      return acc;
    }, {} as Record<string, Deal[]>);
    
    return grouped;
  }, [filteredAndSortedDeals, stages]);

  // Calculate metrics for each stage based on filtered data
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
      };
    });
  }, [stages, dealsByStage]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (!filteredAndSortedDeals) return { totalDeals: 0, totalValue: 0, avgProbability: 0, pendingTasks: 0 };
    
    const totalValue = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_value, 0);
    const avgProbability = filteredAndSortedDeals.length > 0 
      ? filteredAndSortedDeals.reduce((sum, deal) => sum + deal.deal_probability, 0) / filteredAndSortedDeals.length 
      : 0;
    const pendingTasks = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.pending_tasks, 0);
    
    return {
      totalDeals: filteredAndSortedDeals.length,
      totalValue,
      avgProbability,
      pendingTasks,
    };
  }, [filteredAndSortedDeals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !filteredAndSortedDeals) {
      setActiveId(null);
      return;
    }

    const dealId = active.id as string;
    const newStageId = over.id as string;
    
    // Find the deal being moved
    const deal = filteredAndSortedDeals.find(d => d.deal_id === dealId);
    if (!deal || deal.stage_id === newStageId) {
      setActiveId(null);
      return;
    }

    // Update the deal stage
    updateDealStage.mutate({ dealId, stageId: newStageId });
    setActiveId(null);
  };

  if (dealsLoading || stagesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="flex gap-6 overflow-x-auto">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-80 h-96 flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Minimal Top Bar */}
      <div className="flex-shrink-0 bg-background border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Title & Essential Filters */}
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-foreground">Deals</h1>
            
            {/* Listing Filter */}
            <Select value={listingFilter || 'all'} onValueChange={(value) => setListingFilter(value === 'all' ? 'all' : value)}>
              <SelectTrigger className="w-40 h-8 text-sm border-neutral-200 hover:border-neutral-300 transition-colors">
                <SelectValue placeholder="All Listings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Listings</SelectItem>
                {listingOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Admin Filter */}
            <Select value={adminFilter || 'all'} onValueChange={(value) => setAdminFilter(value === 'all' ? 'all' : value)}>
              <SelectTrigger className="w-40 h-8 text-sm border-neutral-200 hover:border-neutral-300 transition-colors">
                <SelectValue placeholder="All Admins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Admins</SelectItem>
                {adminOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search deals..."
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-8 border-neutral-200 hover:border-neutral-300 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Right: Metrics & Actions */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm text-neutral-600">
              <span className="font-medium text-foreground">{overallMetrics.totalDeals}</span>
              <span>deals</span>
              <span className="text-neutral-300">•</span>
              <span className="font-medium text-foreground">{formatCurrency(overallMetrics.totalValue)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onManageStages}
                className="h-8 text-neutral-600 hover:text-foreground hover:bg-neutral-50"
              >
                <Settings className="h-4 w-4" />
                Manage Stages
              </Button>
              <Button 
                onClick={onCreateDeal}
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Deal
              </Button>
            </div>
          </div>
        </div>

        {/* Status Filters Row */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant={statusFilter === 'all' ? "filter-active" : "filter"}
            size="filter"
            onClick={() => setStatusFilter('all')}
            className="h-7"
          >
            All Deals
            <span className="ml-1 text-xs text-neutral-500">({(deals || []).length})</span>
          </Button>
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant={statusFilter === option.value ? "filter-active" : "filter"}
              size="filter"
              onClick={() => setStatusFilter(statusFilter === option.value ? 'all' : option.value as any)}
              className="h-7"
            >
              <option.icon className="h-3 w-3" />
              {option.label}
              <span className="ml-1 text-xs text-neutral-500">({option.count})</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Full-Height Pipeline */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full overflow-x-auto">
            <div className="flex gap-6 min-w-max h-full p-6">
              {stageMetrics.map((stage) => (
                <DealKanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage[stage.id] || []}
                  onDealClick={onDealClick}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <EnhancedDealKanbanCard
                deal={filteredAndSortedDeals?.find((deal) => deal.deal_id === activeId)!}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}