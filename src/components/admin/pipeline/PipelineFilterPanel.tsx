import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { X } from 'lucide-react';
import { PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { cn } from '@/lib/utils';

interface PipelineFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
}

export const PipelineFilterPanel: React.FC<PipelineFilterPanelProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange
}) => {
  const handleFilterChange = (key: keyof PipelineFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
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
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-16 bg-background border-b border-border/50 shadow-sm transform transition-transform duration-200 z-40",
        isOpen ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Filters</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stage Filter */}
          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <Select value={filters.stage} onValueChange={(value) => handleFilterChange('stage', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="new">New Inquiry</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal Sent</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed-won">Closed Won</SelectItem>
                <SelectItem value="closed-lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Owner Filter */}
          <div className="space-y-2">
            <Label htmlFor="owner">Owner</Label>
            <Select value={filters.owner} onValueChange={(value) => handleFilterChange('owner', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                <SelectItem value="me">My Deals</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buyer Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="buyerType">Buyer Type</Label>
            <Select value={filters.buyerType} onValueChange={(value) => handleFilterChange('buyerType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="private-equity">Private Equity</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="family-office">Family Office</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deal Value Range */}
        <div className="mt-6">
          <Label className="mb-4 block">Deal Value Range</Label>
          <div className="px-2">
            <Slider
              value={filters.dealValue}
              onValueChange={(value) => handleFilterChange('dealValue', value)}
              max={10000000}
              step={100000}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>{formatCurrency(filters.dealValue[0])}</span>
              <span>{formatCurrency(filters.dealValue[1])}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};