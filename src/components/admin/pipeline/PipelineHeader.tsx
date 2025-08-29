import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Filter, 
  Settings, 
  Plus, 
  LayoutDashboard, 
  List, 
  Table,
  SlidersHorizontal,
  ChevronDown,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';
import { useState } from 'react';

interface PipelineHeaderProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineHeader({ pipeline }: PipelineHeaderProps) {
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  
  const viewModeIcons = {
    kanban: LayoutDashboard,
    list: List,
    table: Table,
  };
  
  const ViewIcon = viewModeIcons[pipeline.viewMode];
  
  const hasActiveFilters = 
    pipeline.searchQuery ||
    pipeline.statusFilter !== 'all' ||
    pipeline.buyerTypeFilter !== 'all' ||
    pipeline.listingFilter !== 'all' ||
    pipeline.adminFilter !== 'all' ||
    pipeline.documentStatusFilter !== 'all';
  
  return (
    <div className="bg-background/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 gap-4">
        {/* Left Section - Search & Filters */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals, contacts, listings..."
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
              className="pl-10 h-9 bg-background/50 border-border/50 focus:bg-background transition-colors"
            />
            {pipeline.searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => pipeline.setSearchQuery('')}
              >
                ×
              </Button>
            )}
          </div>
          
          {/* Filter Toggle */}
          <Button
            variant={hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            onClick={pipeline.toggleFilterPanel}
            className="relative h-9 px-3"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {[
                  pipeline.searchQuery,
                  pipeline.statusFilter !== 'all' && pipeline.statusFilter,
                  pipeline.buyerTypeFilter !== 'all' && pipeline.buyerTypeFilter,
                  pipeline.listingFilter !== 'all' && pipeline.listingFilter,
                  pipeline.adminFilter !== 'all' && pipeline.adminFilter,
                  pipeline.documentStatusFilter !== 'all' && pipeline.documentStatusFilter,
                ].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>
        
        {/* Center Section - View Controls */}
        <div className="hidden lg:flex items-center gap-2">
          <Select value={pipeline.viewMode} onValueChange={(value: any) => pipeline.setViewMode(value)}>
            <SelectTrigger className="w-32 h-9 bg-background/50 border-border/50">
              <ViewIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">
                <div className="flex items-center">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Kanban
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center">
                  <List className="h-4 w-4 mr-2" />
                  List
                </div>
              </SelectItem>
              <SelectItem value="table">
                <div className="flex items-center">
                  <Table className="h-4 w-4 mr-2" />
                  Table
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Metrics Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={pipeline.toggleMetrics}
            className="h-9 px-3 bg-background/50 border-border/50"
          >
            {pipeline.isMetricsCollapsed ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStageManagementOpen(true)}
            className="hidden lg:inline-flex h-9 bg-background/50 border-border/50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Stages
          </Button>
          
          <Button
            onClick={() => setIsCreateDealOpen(true)}
            size="sm"
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Deal
          </Button>
          
          {/* Mobile View Toggle */}
          <div className="lg:hidden">
            <Select value={pipeline.viewMode} onValueChange={(value: any) => pipeline.setViewMode(value)}>
              <SelectTrigger className="w-10 h-9 bg-background/50 border-border/50 p-0">
                <ViewIcon className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      {pipeline.isMobile && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
              className="pl-10 h-9 bg-background/50 border-border/50"
            />
          </div>
        </div>
      )}
      
      {/* Modals */}
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