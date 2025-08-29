
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';

interface PipelineFilterPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineFilterPanel({ pipeline }: PipelineFilterPanelProps) {
  if (!pipeline.isFilterPanelOpen) return null;

  const activeFiltersCount = [
    pipeline.statusFilter !== 'all',
    pipeline.documentStatusFilter !== 'all',
    pipeline.buyerTypeFilter !== 'all',
    pipeline.listingFilter !== 'all',
    pipeline.adminFilter !== 'all',
    pipeline.searchQuery.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 lg:relative lg:bg-transparent lg:backdrop-blur-none">
      <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg lg:relative lg:w-full lg:h-auto lg:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Filters</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={pipeline.toggleFilterPanel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Quick Filters */}
          <div>
            <h4 className="font-medium mb-3">Status</h4>
            <div className="space-y-2">
              {[
                { value: 'all', label: 'All Deals' },
                { value: 'new_inquiry', label: 'New Inquiry' },
                { value: 'qualified', label: 'Qualified' },
                { value: 'due_diligence', label: 'Due Diligence' },
                { value: 'under_contract', label: 'Under Contract' },
                { value: 'closed', label: 'Closed' },
              ].map((status) => (
                <Button
                  key={status.value}
                  variant={pipeline.statusFilter === status.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => pipeline.setStatusFilter(status.value as any)}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Buyer Type */}
          <div>
            <h4 className="font-medium mb-3">Buyer Type</h4>
            <div className="space-y-2">
              {[
                { value: 'all', label: 'All Types' },
                { value: 'privateEquity', label: 'Private Equity' },
                { value: 'familyOffice', label: 'Family Office' },
                { value: 'searchFund', label: 'Search Fund' },
                { value: 'corporate', label: 'Corporate' },
                { value: 'individual', label: 'Individual' },
              ].map((type) => (
                <Button
                  key={type.value}
                  variant={pipeline.buyerTypeFilter === type.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => pipeline.setBuyerTypeFilter(type.value as any)}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Document Status */}
          <div>
            <h4 className="font-medium mb-3">Documents</h4>
            <div className="space-y-2">
              {[
                { value: 'all', label: 'All Documents' },
                { value: 'both_signed', label: 'Both Signed' },
                { value: 'nda_signed', label: 'NDA Signed' },
                { value: 'fee_signed', label: 'Fee Signed' },
                { value: 'none_signed', label: 'None Signed' },
                { value: 'overdue_followup', label: 'Overdue Follow-up' },
              ].map((doc) => (
                <Button
                  key={doc.value}
                  variant={pipeline.documentStatusFilter === doc.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => pipeline.setDocumentStatusFilter(doc.value as any)}
                >
                  {doc.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                pipeline.setStatusFilter('all');
                pipeline.setDocumentStatusFilter('all');
                pipeline.setBuyerTypeFilter('all');
                pipeline.setListingFilter('all');
                pipeline.setAdminFilter('all');
                pipeline.setSearchQuery('');
              }}
            >
              Clear All Filters
            </Button>
            <Button
              className="w-full"
              onClick={pipeline.toggleFilterPanel}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
