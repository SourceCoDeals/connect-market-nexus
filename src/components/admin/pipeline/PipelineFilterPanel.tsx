import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  X, 
  CalendarIcon, 
  Building2, 
  UserCircle,
  Filter,
  Clock,
  CheckCircle2,
  FileText,
  Users,
  ShieldCheck,
  Target,
  XCircle,
  Save,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { useFilterPresets, useDeleteFilterPreset } from '@/hooks/admin/use-filter-presets';
import { SaveFilterPresetDialog } from './SaveFilterPresetDialog';
import { useState as useReactState } from 'react';

interface PipelineFilterPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineFilterPanel({ pipeline }: PipelineFilterPanelProps) {
  const [isSavePresetOpen, setIsSavePresetOpen] = useReactState(false);
  const { data: presets = [] } = useFilterPresets();
  const deletePreset = useDeleteFilterPreset();
  
  if (!pipeline.isFilterPanelOpen) return null;

  const activeFiltersCount = [
    pipeline.statusFilter !== 'all',
    pipeline.documentStatusFilter !== 'all',
    pipeline.buyerTypeFilter !== 'all',
    pipeline.companyFilter.length > 0,
    pipeline.adminFilter !== 'all',
    pipeline.createdDateRange.start !== null,
    pipeline.createdDateRange.end !== null,
    pipeline.lastActivityRange.start !== null,
    pipeline.lastActivityRange.end !== null,
    pipeline.searchQuery.trim() !== '',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    pipeline.setStatusFilter('all');
    pipeline.setDocumentStatusFilter('all');
    pipeline.setBuyerTypeFilter('all');
    pipeline.setCompanyFilter([]);
    pipeline.setAdminFilter('all');
    pipeline.setCreatedDateRange({ start: null, end: null });
    pipeline.setLastActivityRange({ start: null, end: null });
    pipeline.setSearchQuery('');
  };

  const getCurrentFilters = () => ({
    statusFilter: pipeline.statusFilter,
    documentStatusFilter: pipeline.documentStatusFilter,
    buyerTypeFilter: pipeline.buyerTypeFilter,
    companyFilter: pipeline.companyFilter,
    adminFilter: pipeline.adminFilter,
    createdDateRange: pipeline.createdDateRange,
    lastActivityRange: pipeline.lastActivityRange,
    searchQuery: pipeline.searchQuery,
  });

  const loadPreset = (preset: any) => {
    const filters = preset.filters;
    if (filters.statusFilter) pipeline.setStatusFilter(filters.statusFilter);
    if (filters.documentStatusFilter) pipeline.setDocumentStatusFilter(filters.documentStatusFilter);
    if (filters.buyerTypeFilter) pipeline.setBuyerTypeFilter(filters.buyerTypeFilter);
    if (filters.companyFilter) pipeline.setCompanyFilter(filters.companyFilter);
    if (filters.adminFilter) pipeline.setAdminFilter(filters.adminFilter);
    if (filters.createdDateRange) pipeline.setCreatedDateRange(filters.createdDateRange);
    if (filters.lastActivityRange) pipeline.setLastActivityRange(filters.lastActivityRange);
    if (filters.searchQuery) pipeline.setSearchQuery(filters.searchQuery);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:relative lg:bg-transparent lg:backdrop-blur-none lg:z-auto">
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l shadow-2xl lg:relative lg:w-full lg:h-auto lg:shadow-none overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Filters</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Saved Presets */}
            {presets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm font-semibold">Saved Presets</div>
                  <DropdownMenuSeparator />
                  {presets.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onSelect={() => loadPreset(preset)}
                      className="flex items-center justify-between"
                    >
                      <span>{preset.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset.mutate(preset.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Save Current Filters */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsSavePresetOpen(true)}
              title="Save current filters"
            >
              <Save className="h-4 w-4" />
            </Button>
            
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

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-140px)] lg:h-[600px]">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Search - Always visible */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search deals, buyers..."
                value={pipeline.searchQuery}
                onChange={(e) => pipeline.setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Collapsible Filter Sections */}
            <Accordion type="multiple" defaultValue={['stage', 'company', 'admin']} className="space-y-2">
              {/* Stage Status */}
              <AccordionItem value="stage" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Stage
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Stages', icon: Target },
                      { value: 'new_inquiry', label: 'New Inquiry', icon: Clock },
                      { value: 'approved', label: 'Approved', icon: CheckCircle2 },
                      { value: 'info_sent', label: 'Info Sent', icon: FileText },
                      { value: 'buyer_seller_call', label: 'Buyer/Seller Call', icon: Users },
                      { value: 'due_diligence', label: 'Due Diligence', icon: ShieldCheck },
                      { value: 'loi_submitted', label: 'LOI Submitted', icon: FileText },
                      { value: 'closed', label: 'Closed', icon: XCircle },
                    ].map((status) => {
                      const Icon = status.icon;
                      return (
                        <Button
                          key={status.value}
                          variant={pipeline.statusFilter === status.value ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => pipeline.setStatusFilter(status.value as any)}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {status.label}
                        </Button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Company Filter */}
              <AccordionItem value="company" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company
                    {pipeline.companyFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {pipeline.companyFilter.length}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <MultiSelect
                    options={pipeline.uniqueCompanies || []}
                    selected={pipeline.companyFilter}
                    onSelectedChange={pipeline.setCompanyFilter}
                    placeholder="All companies"
                    className="w-full"
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Admin/Owner Filter */}
              <AccordionItem value="admin" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    Assigned To
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2">
                    <Button
                      variant={pipeline.adminFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => pipeline.setAdminFilter('all')}
                    >
                      All Deals
                    </Button>
                    <Button
                      variant={pipeline.adminFilter === 'assigned_to_me' ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => pipeline.setAdminFilter('assigned_to_me')}
                    >
                      <UserCircle className="h-4 w-4 mr-2" />
                      Assigned to Me
                    </Button>
                    <Button
                      variant={pipeline.adminFilter === 'unassigned' ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => pipeline.setAdminFilter('unassigned')}
                    >
                      Unassigned
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Date Filters */}
              <AccordionItem value="dates" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Date Ranges
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  {/* Created Date Range */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Created Date</label>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !pipeline.createdDateRange.start && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pipeline.createdDateRange.start ? (
                              format(pipeline.createdDateRange.start, 'PPP')
                            ) : (
                              <span>Start date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pipeline.createdDateRange.start || undefined}
                            onSelect={(date) =>
                              pipeline.setCreatedDateRange({
                                ...pipeline.createdDateRange,
                                start: date || null,
                              })
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !pipeline.createdDateRange.end && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pipeline.createdDateRange.end ? (
                              format(pipeline.createdDateRange.end, 'PPP')
                            ) : (
                              <span>End date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pipeline.createdDateRange.end || undefined}
                            onSelect={(date) =>
                              pipeline.setCreatedDateRange({
                                ...pipeline.createdDateRange,
                                end: date || null,
                              })
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Separator />

                  {/* Last Activity Range */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Last Activity</label>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !pipeline.lastActivityRange.start && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pipeline.lastActivityRange.start ? (
                              format(pipeline.lastActivityRange.start, 'PPP')
                            ) : (
                              <span>Start date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pipeline.lastActivityRange.start || undefined}
                            onSelect={(date) =>
                              pipeline.setLastActivityRange({
                                ...pipeline.lastActivityRange,
                                start: date || null,
                              })
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !pipeline.lastActivityRange.end && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pipeline.lastActivityRange.end ? (
                              format(pipeline.lastActivityRange.end, 'PPP')
                            ) : (
                              <span>End date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pipeline.lastActivityRange.end || undefined}
                            onSelect={(date) =>
                              pipeline.setLastActivityRange({
                                ...pipeline.lastActivityRange,
                                end: date || null,
                              })
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Additional Filters */}
              <AccordionItem value="additional" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                  Additional Filters
                </AccordionTrigger>
                <AccordionContent className="pb-4 space-y-4">
                  {/* Buyer Type */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Buyer Type</label>
                    <Select
                      value={pipeline.buyerTypeFilter}
                      onValueChange={(value) => pipeline.setBuyerTypeFilter(value as any)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All buyer types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Buyer Types</SelectItem>
                        <SelectItem value="privateEquity">Private Equity</SelectItem>
                        <SelectItem value="familyOffice">Family Office</SelectItem>
                        <SelectItem value="searchFund">Search Fund</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="independentSponsor">Independent Sponsor</SelectItem>
                        <SelectItem value="advisor">Advisor / Banker</SelectItem>
                        <SelectItem value="businessOwner">Business Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Document Status */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Documents</label>
                    <Select
                      value={pipeline.documentStatusFilter}
                      onValueChange={(value) => pipeline.setDocumentStatusFilter(value as any)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All documents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Documents</SelectItem>
                        <SelectItem value="both_signed">NDA & Fee Signed</SelectItem>
                        <SelectItem value="nda_signed">NDA Signed Only</SelectItem>
                        <SelectItem value="fee_signed">Fee Signed Only</SelectItem>
                        <SelectItem value="none_signed">No Documents</SelectItem>
                        <SelectItem value="overdue_followup">Overdue Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium mb-3 block">Active Filters</label>
                  <div className="flex flex-wrap gap-2">
                    {pipeline.statusFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        Stage: {pipeline.statusFilter}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => pipeline.setStatusFilter('all')}
                        />
                      </Badge>
                    )}
                    {pipeline.companyFilter.length > 0 && 
                      pipeline.companyFilter.map(company => (
                        <Badge key={company} variant="secondary" className="gap-1">
                          Company: {company}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => pipeline.setCompanyFilter(pipeline.companyFilter.filter(c => c !== company))}
                          />
                        </Badge>
                      ))
                    }
                    {pipeline.adminFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        Admin: {pipeline.adminFilter === 'assigned_to_me' ? 'Me' : pipeline.adminFilter}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => pipeline.setAdminFilter('all')}
                        />
                      </Badge>
                    )}
                    {pipeline.createdDateRange.start && (
                      <Badge variant="secondary" className="gap-1">
                        Created: {format(pipeline.createdDateRange.start, 'PP')}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() =>
                            pipeline.setCreatedDateRange({ ...pipeline.createdDateRange, start: null })
                          }
                        />
                      </Badge>
                    )}
                    {pipeline.lastActivityRange.start && (
                      <Badge variant="secondary" className="gap-1">
                        Activity: {format(pipeline.lastActivityRange.start, 'PP')}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() =>
                            pipeline.setLastActivityRange({ ...pipeline.lastActivityRange, start: null })
                          }
                        />
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearAllFilters}>
              Clear All
            </Button>
            <Button className="flex-1" onClick={pipeline.toggleFilterPanel}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
      
      {/* Save Preset Dialog */}
      <SaveFilterPresetDialog
        open={isSavePresetOpen}
        onOpenChange={setIsSavePresetOpen}
        currentFilters={getCurrentFilters()}
      />
    </div>
  );
}
