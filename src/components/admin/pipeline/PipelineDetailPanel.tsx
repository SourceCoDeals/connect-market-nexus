
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, User, Building2, Calendar, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { formatDistanceToNow } from 'date-fns';

interface PipelineDetailPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineDetailPanel({ pipeline }: PipelineDetailPanelProps) {
  const { selectedDeal } = pipeline;

  if (!selectedDeal) {
    return (
      <div className="w-80 border-l bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Select a deal to view details</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Deal Details</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pipeline.setSelectedDeal(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Deal Title */}
        <div>
          <h4 className="font-semibold text-lg mb-2">{selectedDeal.deal_title}</h4>
          {selectedDeal.deal_priority && (
            <Badge className={getPriorityColor(selectedDeal.deal_priority)}>
              {selectedDeal.deal_priority} priority
            </Badge>
          )}
        </div>

        <Separator />

        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Deal Value</p>
              <p className="font-semibold">{formatCurrency(selectedDeal.deal_value)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Probability</p>
              <p className="font-semibold">{selectedDeal.deal_probability}%</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Contact</p>
              <p className="font-semibold">{selectedDeal.contact_name || 'Unknown'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Listing</p>
              <p className="font-semibold text-sm">{selectedDeal.listing_title}</p>
            </div>
          </div>

          {selectedDeal.deal_expected_close_date && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Expected Close</p>
                <p className="font-semibold">
                  {formatDistanceToNow(new Date(selectedDeal.deal_expected_close_date), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}

          {selectedDeal.pending_tasks > 0 && (
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="font-semibold text-orange-600">{selectedDeal.pending_tasks}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Documents */}
        <div>
          <h5 className="font-medium mb-3">Documents</h5>
          <div className="space-y-2">
            {selectedDeal.nda_status === 'signed' && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                NDA Signed
              </Badge>
            )}
            {selectedDeal.fee_agreement_status === 'signed' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Fee Agreement Signed
              </Badge>
            )}
            {selectedDeal.nda_status !== 'signed' && selectedDeal.fee_agreement_status !== 'signed' && (
              <p className="text-sm text-muted-foreground">No documents signed</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Stage Info */}
        <div>
          <h5 className="font-medium mb-3">Stage Information</h5>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Current Stage:</span>{' '}
              <span className="font-medium">{selectedDeal.stage_name}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Time in Stage:</span>{' '}
              <span className="font-medium">
                {formatDistanceToNow(new Date(selectedDeal.deal_stage_entered_at))}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <Button 
          className="w-full" 
          size="sm"
          onClick={() => pipeline.setIsDetailPanelOpen(true)}
        >
          View Full Details
        </Button>
        <Button variant="outline" className="w-full" size="sm">
          Edit Deal
        </Button>
      </div>
    </div>
  );
}
