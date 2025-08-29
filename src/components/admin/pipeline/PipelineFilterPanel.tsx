import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  X, 
  Filter, 
  Search, 
  Calendar,
  DollarSign,
  Target,
  Users,
  FileText,
  Bookmark
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';

interface PipelineFilterPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineFilterPanel({ pipeline }: PipelineFilterPanelProps) {
  const clearAllFilters = () => {
    pipeline.setSearchQuery('');
    pipeline.setStatusFilter('all');
    pipeline.setBuyerTypeFilter('all');
    pipeline.setListingFilter('all');
    pipeline.setAdminFilter('all');
    pipeline.setDocumentStatusFilter('all');
    pipeline.setSortOption('newest');
  };
  
  const hasActiveFilters = 
    pipeline.searchQuery ||
    pipeline.statusFilter !== 'all' ||
    pipeline.buyerTypeFilter !== 'all' ||
    pipeline.listingFilter !== 'all' ||
    pipeline.adminFilter !== 'all' ||
    pipeline.documentStatusFilter !== 'all';
  
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search deals, contacts, listings..."
            value={pipeline.searchQuery}
            onChange={(e) => pipeline.setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {pipeline.searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => pipeline.setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      <Separator />
      
      {/* Quick Filters */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Quick Filters</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={pipeline.statusFilter === 'hot' ? 'default' : 'outline'}
            size="sm"
            onClick={() => pipeline.setStatusFilter(pipeline.statusFilter === 'hot' ? 'all' : 'hot')}
            className="h-8"
          >
            <Target className="h-3 w-3 mr-2" />
            Hot Deals
          </Button>
          <Button
            variant={pipeline.documentStatusFilter === 'overdue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => pipeline.setDocumentStatusFilter(pipeline.documentStatusFilter === 'overdue' ? 'all' : 'overdue')}
            className="h-8"
          >
            <Calendar className="h-3 w-3 mr-2" />
            Overdue
          </Button>
          <Button
            variant={pipeline.statusFilter === 'closing-soon' ? 'default' : 'outline'}
            size="sm"
            onClick={() => pipeline.setStatusFilter(pipeline.statusFilter === 'closing-soon' ? 'all' : 'closing-soon')}
            className="h-8"
          >
            <Calendar className="h-3 w-3 mr-2" />
            Closing Soon
          </Button>
        </div>
      </div>
      
      <Separator />
      
      {/* Stage Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Stage</Label>
        <Select value={pipeline.statusFilter} onValueChange={(value: any) => pipeline.setStatusFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {pipeline.stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Buyer Type Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Buyer Type</Label>
        <Select value={pipeline.buyerTypeFilter} onValueChange={(value: any) => pipeline.setBuyerTypeFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select buyer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="privateEquity">Private Equity</SelectItem>
            <SelectItem value="familyOffice">Family Office</SelectItem>
            <SelectItem value="searchFund">Search Fund</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="independentSponsor">Independent Sponsor</SelectItem>
            <SelectItem value="advisor">Advisor</SelectItem>
            <SelectItem value="businessOwner">Business Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Assigned Admin Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Assigned To</Label>
        <Select value={pipeline.adminFilter} onValueChange={pipeline.setAdminFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Select admin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Admins</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {/* We would need to get unique admin names from deals */}
            {Array.from(new Set(pipeline.deals.map(d => d.assigned_admin_name).filter(Boolean))).map((admin) => (
              <SelectItem key={admin} value={admin!}>
                {admin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Document Status Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Document Status</Label>
        <Select value={pipeline.documentStatusFilter} onValueChange={pipeline.setDocumentStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="nda-pending">NDA Pending</SelectItem>
            <SelectItem value="nda-signed">NDA Signed</SelectItem>
            <SelectItem value="fee-pending">Fee Agreement Pending</SelectItem>
            <SelectItem value="fee-signed">Fee Agreement Signed</SelectItem>
            <SelectItem value="documents-complete">Documents Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      {/* Sort Options */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Sort By</Label>
        <Select value={pipeline.sortOption} onValueChange={pipeline.setSortOption}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="value-high">Highest Value</SelectItem>
            <SelectItem value="value-low">Lowest Value</SelectItem>
            <SelectItem value="probability-high">Highest Probability</SelectItem>
            <SelectItem value="probability-low">Lowest Probability</SelectItem>
            <SelectItem value="close-date">Expected Close Date</SelectItem>
            <SelectItem value="stage-time">Days in Stage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active Filters</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-xs h-6 px-2"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {pipeline.searchQuery && (
              <Badge variant="secondary" className="text-xs">
                Search: {pipeline.searchQuery}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => pipeline.setSearchQuery('')}
                />
              </Badge>
            )}
            {pipeline.statusFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Stage: {pipeline.statusFilter}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => pipeline.setStatusFilter('all')}
                />
              </Badge>
            )}
            {pipeline.buyerTypeFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Buyer: {pipeline.buyerTypeFilter}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => pipeline.setBuyerTypeFilter('all')}
                />
              </Badge>
            )}
            {pipeline.adminFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Admin: {pipeline.adminFilter}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => pipeline.setAdminFilter('all')}
                />
              </Badge>
            )}
            {pipeline.documentStatusFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Doc: {pipeline.documentStatusFilter}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => pipeline.setDocumentStatusFilter('all')}
                />
              </Badge>
            )}
          </div>
        </div>
      )}
      
      {/* Save Filters */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full" size="sm">
          <Bookmark className="h-4 w-4 mr-2" />
          Save Current View
        </Button>
      </div>
    </div>
  );
  
  // Mobile: Use Sheet
  if (pipeline.isMobile) {
    return (
      <Sheet open={pipeline.isFilterPanelOpen} onOpenChange={pipeline.setIsFilterPanelOpen}>
        <SheetContent side="right" className="w-full sm:w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {[
                    pipeline.searchQuery,
                    pipeline.statusFilter !== 'all' && pipeline.statusFilter,
                    pipeline.buyerTypeFilter !== 'all' && pipeline.buyerTypeFilter,
                    pipeline.adminFilter !== 'all' && pipeline.adminFilter,
                    pipeline.documentStatusFilter !== 'all' && pipeline.documentStatusFilter,
                  ].filter(Boolean).length}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  
  // Desktop: Side Panel
  if (!pipeline.isFilterPanelOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={pipeline.toggleFilterPanel}>
      <div 
        className="absolute right-0 top-0 h-full w-96 bg-background border-l border-border/50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary">
                  {[
                    pipeline.searchQuery,
                    pipeline.statusFilter !== 'all' && pipeline.statusFilter,
                    pipeline.buyerTypeFilter !== 'all' && pipeline.buyerTypeFilter,
                    pipeline.adminFilter !== 'all' && pipeline.adminFilter,
                    pipeline.documentStatusFilter !== 'all' && pipeline.documentStatusFilter,
                  ].filter(Boolean).length}
                </Badge>
              )}
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={pipeline.toggleFilterPanel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto h-full">
          <FilterContent />
        </div>
      </div>
    </div>
  );
}