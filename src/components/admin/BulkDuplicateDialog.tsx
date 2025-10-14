import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mail, Building2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { DuplicateInfo } from '@/hooks/admin/use-bulk-deal-import';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface BulkDuplicateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: Array<{
    deal: {
      csvRowNumber: number;
      date: Date | null;
      name: string;
      email: string;
      companyName: string;
      message: string;
    };
    duplicateInfo: DuplicateInfo;
  }>;
  onSkipAll: () => void;
  onReviewIndividually: () => void;
}

const getDuplicateTypeLabel = (type: DuplicateInfo['type']): { label: string; variant: 'default' | 'secondary' | 'outline' } => {
  switch (type) {
    case 'exact_user_and_listing':
      return { label: 'Exact Match', variant: 'default' };
    case 'lead_email_and_listing':
      return { label: 'Same Email', variant: 'secondary' };
    case 'same_company_different_email':
      return { label: 'Same Company', variant: 'outline' };
    case 'cross_source_inbound_lead':
      return { label: 'Converted Lead', variant: 'outline' };
    default:
      return { label: 'Duplicate', variant: 'outline' };
  }
};

export function BulkDuplicateDialog({
  isOpen,
  onClose,
  duplicates,
  onSkipAll,
  onReviewIndividually,
}: BulkDuplicateDialogProps) {
  if (duplicates.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-8 pt-8 pb-6 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                Duplicate Records
              </DialogTitle>
              <DialogDescription className="text-base">
                {duplicates.length} record{duplicates.length > 1 ? 's' : ''} already exist in the system
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{duplicates.length}</span>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Stats Grid */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-3xl font-semibold tracking-tight">
                {duplicates.filter(d => d.duplicateInfo.type === 'exact_user_and_listing').length}
              </div>
              <div className="text-sm text-muted-foreground">Exact Matches</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-semibold tracking-tight">
                {duplicates.filter(d => d.duplicateInfo.userProfile).length}
              </div>
              <div className="text-sm text-muted-foreground">Linked Users</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-semibold tracking-tight">
                {duplicates.filter(d => d.duplicateInfo.type === 'same_company_different_email').length}
              </div>
              <div className="text-sm text-muted-foreground">Company Matches</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Records List */}
        <div className="flex-1 min-h-0 px-8 py-6">
          <ScrollArea className="h-[400px] -mx-8 px-8">
            <div className="space-y-3 pr-4">
              {duplicates.map((dup, index) => {
                const { deal, duplicateInfo } = dup;
                const typeInfo = getDuplicateTypeLabel(duplicateInfo.type);

                return (
                  <div
                    key={index}
                    className="group relative rounded-xl border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-sm"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-6 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-medium">
                          {deal.csvRowNumber}
                        </div>
                        <Badge variant={typeInfo.variant} className="text-xs font-normal">
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {duplicateInfo.existingCreatedAt 
                          ? format(new Date(duplicateInfo.existingCreatedAt), 'MMM d, yyyy')
                          : 'Unknown date'}
                      </div>
                    </div>

                    {/* Contact Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span>Contact</span>
                        </div>
                        <div className="font-medium">{deal.name}</div>
                        <div className="text-sm text-muted-foreground">{deal.email}</div>
                      </div>
                      
                      {deal.companyName && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>Company</span>
                          </div>
                          <div className="font-medium">{deal.companyName}</div>
                          {duplicateInfo.userProfile && (
                            <div className="text-sm text-muted-foreground">
                              Marketplace user
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="mt-4 pt-4 border-t flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="text-xs font-normal capitalize">
                        {duplicateInfo.existingStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Footer Actions */}
        <div className="px-8 py-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            These contacts have already requested this listing. Choose to skip all duplicates or review each individually.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              onClick={() => {
                onSkipAll();
                onClose();
              }}
              className="w-full"
            >
              Skip All {duplicates.length} Duplicates
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                onReviewIndividually();
                onClose();
              }}
              className="w-full"
            >
              Review Individually
            </Button>
          </div>

          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="w-full"
          >
            Cancel Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
