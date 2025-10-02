
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Search,
  Filter,
  MoreVertical,
  Plus,
  Kanban,
  List,
  Table,
  Menu,
  X,
  CalendarIcon,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePipelineCore, ViewMode } from '@/hooks/admin/use-pipeline-core';
import { PipelineViewSwitcher } from './PipelineViewSwitcher';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';


interface PipelineHeaderProps {
  pipeline: ReturnType<typeof usePipelineCore>;
  onOpenCreateDeal: () => void;
}

export function PipelineHeader({ pipeline, onOpenCreateDeal }: PipelineHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: adminProfiles } = useAdminProfiles();

  const viewIcons = {
    kanban: Kanban,
    list: List,
    table: Table,
  };

  // Count active filters for badge
  const activeFiltersCount = [
    pipeline.statusFilter !== 'all',
    pipeline.documentStatusFilter !== 'all',
    pipeline.buyerTypeFilter !== 'all',
    pipeline.companyFilter.length > 0,
    pipeline.adminFilter !== 'all',
    pipeline.listingFilter !== 'all',
    pipeline.createdDateRange.start !== null,
    pipeline.createdDateRange.end !== null,
    pipeline.lastActivityRange.start !== null,
    pipeline.lastActivityRange.end !== null,
  ].filter(Boolean).length;

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* First Row - Main Actions */}
      <div className="flex items-center justify-between p-4 border-b">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Pipeline</h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {`${pipeline.deals.length} deals`}
            </Badge>
          </div>

          {/* Pipeline View Switcher - Desktop only */}
          <div className="hidden md:block">
            <PipelineViewSwitcher
              currentViewId={pipeline.currentViewId || undefined}
              onViewChange={pipeline.setCurrentViewId}
            />
          </div>

          {/* Desktop Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              className="pl-9 w-64"
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* View Mode Selector */}
          <Select value={pipeline.viewMode} onValueChange={(value) => pipeline.setViewMode(value as ViewMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">
                <div className="flex items-center gap-2">
                  <Kanban className="h-4 w-4" />
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

          <Button size="sm" className="gap-2" onClick={onOpenCreateDeal}>
            <Plus className="h-4 w-4" />
            New Deal
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Pipeline</DropdownMenuItem>
              <DropdownMenuItem>Import Deals</DropdownMenuItem>
              <DropdownMenuItem>Pipeline Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Second Row - Filters Bar (Desktop) */}
      <div className="hidden md:flex items-center gap-2 px-4 py-3 overflow-x-auto">
        {/* Deal/Listing Filter - NOW FIRST */}
        <Select
          value={pipeline.listingFilter}
          onValueChange={(value) => pipeline.setListingFilter(value)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Listings" />
          </SelectTrigger>
          <SelectContent className="bg-background z-[100] max-h-[300px]">
            <SelectItem value="all">All Listings</SelectItem>
            {pipeline.uniqueListings?.map((listing) => (
              <SelectItem key={listing.id} value={listing.id}>
                {listing.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stage Filter - NOW SECOND */}
        <Select
          value={pipeline.statusFilter}
          onValueChange={(value) => pipeline.setStatusFilter(value as any)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent className="bg-background z-[100]">
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="new_inquiry">New Inquiry</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="info_sent">Info Sent</SelectItem>
            <SelectItem value="buyer_seller_call">Buyer/Seller Call</SelectItem>
            <SelectItem value="due_diligence">Due Diligence</SelectItem>
            <SelectItem value="loi_submitted">LOI Submitted</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Buyer Company Filter (Multi-select) - NOW THIRD, filters by BUYER's company */}
        <MultiSelect
          options={pipeline.uniqueCompanies || []}
          selected={pipeline.companyFilter}
          onSelectedChange={pipeline.setCompanyFilter}
          placeholder="All Buyer Companies"
          className="w-[200px] h-9"
        />

        {/* Deal Owner Filter */}
        <Select
          value={pipeline.adminFilter}
          onValueChange={(value) => pipeline.setAdminFilter(value)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All Deals" />
          </SelectTrigger>
          <SelectContent className="bg-background z-[100] max-h-[300px]">
            <SelectItem value="all">All Deals</SelectItem>
            <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {adminProfiles && Object.values(adminProfiles).map((admin) => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.first_name} {admin.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Created Date Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 gap-2',
                (pipeline.createdDateRange.start || pipeline.createdDateRange.end) && 'bg-primary/10'
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              Create date
              {(pipeline.createdDateRange.start || pipeline.createdDateRange.end) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">1</Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-background z-[100]" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Created Date Range</div>
              <div className="space-y-2">
                <Calendar
                  mode="single"
                  selected={pipeline.createdDateRange.start || undefined}
                  onSelect={(date) =>
                    pipeline.setCreatedDateRange({
                      ...pipeline.createdDateRange,
                      start: date || null,
                    })
                  }
                  className="rounded-md border"
                />
                {pipeline.createdDateRange.start && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => pipeline.setCreatedDateRange({ start: null, end: null })}
                    className="w-full"
                  >
                    Clear dates
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Last Activity Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 gap-2',
                (pipeline.lastActivityRange.start || pipeline.lastActivityRange.end) && 'bg-primary/10'
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              Last activity
              {(pipeline.lastActivityRange.start || pipeline.lastActivityRange.end) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">1</Badge>
              )}
              <ChevronDown className="h-3 w-3 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-background z-[100]" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Last Activity Range</div>
              <div className="space-y-2">
                <Calendar
                  mode="single"
                  selected={pipeline.lastActivityRange.start || undefined}
                  onSelect={(date) =>
                    pipeline.setLastActivityRange({
                      ...pipeline.lastActivityRange,
                      start: date || null,
                    })
                  }
                  className="rounded-md border"
                />
                {pipeline.lastActivityRange.start && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => pipeline.setLastActivityRange({ start: null, end: null })}
                    className="w-full"
                  >
                    Clear dates
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* All Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={pipeline.toggleFilterPanel}
          className="h-9 gap-2"
        >
          <Filter className="h-4 w-4" />
          All filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-4">
          {/* Mobile Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              className="pl-9"
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mobile View Mode */}
          <div className="flex gap-2">
            {Object.entries(viewIcons).map(([mode, Icon]) => (
              <Button
                key={mode}
                variant={pipeline.viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => pipeline.setViewMode(mode as ViewMode)}
                className="flex-1"
              >
                <Icon className="h-4 w-4 mr-2" />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>

          {/* Mobile Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={pipeline.toggleFilterPanel}
              className="flex-1"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          <Button size="sm" className="w-full" onClick={onOpenCreateDeal}>
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>
      )}
    </div>
  );
}
