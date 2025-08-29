
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Settings, 
  Plus, 
  LayoutGrid, 
  List, 
  Table,
  Menu,
  X
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { CreateDealModal } from '@/components/admin/CreateDealModal';
import { StageManagementModal } from '@/components/admin/StageManagementModal';

export function PipelineHeader() {
  const pipeline = usePipelineCore();
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const viewModeIcons = {
    kanban: LayoutGrid,
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
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-0 z-50">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 md:hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-8 w-8 p-0"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={pipeline.viewMode} onValueChange={(value: any) => pipeline.setViewMode(value)}>
            <SelectTrigger className="w-8 h-8 p-0 border-none">
              <ViewIcon className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List
                </div>
              </SelectItem>
              <SelectItem value="table">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  Table
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={() => setIsCreateDealOpen(true)}
            size="sm"
            className="h-8 px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="border-t bg-background/95 backdrop-blur md:hidden">
          <div className="p-4 space-y-3">
            <Button
              variant={hasActiveFilters ? "secondary" : "outline"}
              size="sm"
              onClick={pipeline.toggleFilterPanel}
              className="w-full justify-start h-9"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto">
                  {[
                    pipeline.statusFilter !== 'all',
                    pipeline.buyerTypeFilter !== 'all',
                    pipeline.listingFilter !== 'all',
                    pipeline.adminFilter !== 'all',
                    pipeline.documentStatusFilter !== 'all',
                  ].filter(Boolean).length}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={pipeline.toggleMetrics}
              className="w-full justify-start h-9"
            >
              {pipeline.isMetricsCollapsed ? 'Show Metrics' : 'Hide Metrics'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsStageManagementOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full justify-start h-9"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Stages
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 gap-6">
        {/* Left Section */}
        <div className="flex items-center gap-4 flex-1 max-w-2xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals, contacts, listings..."
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          
          <Button
            variant={hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            onClick={pipeline.toggleFilterPanel}
            className="h-9 px-3"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {[
                  pipeline.statusFilter !== 'all',
                  pipeline.buyerTypeFilter !== 'all', 
                  pipeline.listingFilter !== 'all',
                  pipeline.adminFilter !== 'all',
                  pipeline.documentStatusFilter !== 'all',
                ].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>
        
        {/* Center Section */}
        <div className="flex items-center gap-3">
          <Select value={pipeline.viewMode} onValueChange={(value: any) => pipeline.setViewMode(value)}>
            <SelectTrigger className="w-32 h-9">
              <ViewIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List
                </div>
              </SelectItem>
              <SelectItem value="table">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  Table
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={pipeline.toggleMetrics}
            className="h-9 px-3"
          >
            {pipeline.isMetricsCollapsed ? 'Show Metrics' : 'Hide'}
          </Button>
        </div>
        
        {/* Right Section */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStageManagementOpen(true)}
            className="h-9"
          >
            <Settings className="h-4 w-4 mr-2" />
            Stages
          </Button>
          
          <Button
            onClick={() => setIsCreateDealOpen(true)}
            size="sm"
            className="h-9"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Deal
          </Button>
        </div>
      </div>
      
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
