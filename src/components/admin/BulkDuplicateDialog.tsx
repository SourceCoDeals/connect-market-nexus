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
import { AlertTriangle, Calendar, Mail, Building2, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { DuplicateInfo } from '@/hooks/admin/use-bulk-deal-import';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const getDuplicateTypeLabel = (type: DuplicateInfo['type']): { label: string; color: string } => {
  switch (type) {
    case 'exact_user_and_listing':
      return { label: 'Existing User + Same Listing', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
    case 'lead_email_and_listing':
      return { label: 'Same Email + Same Listing', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' };
    case 'same_company_different_email':
      return { label: 'Same Company, Different Email', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    case 'cross_source_inbound_lead':
      return { label: 'Already Converted from Inbound Lead', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' };
    default:
      return { label: 'Duplicate Detected', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' };
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <DialogTitle>Duplicate Records Detected</DialogTitle>
          </div>
          <DialogDescription>
            Found {duplicates.length} duplicate record{duplicates.length > 1 ? 's' : ''} that already exist in the system.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 flex-shrink-0">
          <div className="bg-muted/50 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">{duplicates.length}</div>
            <div className="text-sm text-muted-foreground">Total Duplicates</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">
              {duplicates.filter(d => d.duplicateInfo.type === 'exact_user_and_listing').length}
            </div>
            <div className="text-sm text-muted-foreground">Exact Matches</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              {duplicates.filter(d => d.duplicateInfo.userProfile).length}
            </div>
            <div className="text-sm text-muted-foreground">Linked to Users</div>
          </div>
        </div>

        {/* Duplicate List */}
        <div className="flex-1 min-h-0">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Duplicate Records
          </h3>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-3">
              {duplicates.map((dup, index) => {
                const { deal, duplicateInfo } = dup;
                const typeInfo = getDuplicateTypeLabel(duplicateInfo.type);

                return (
                  <div
                    key={index}
                    className="bg-card border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Row Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          Row {deal.csvRowNumber}
                        </Badge>
                        <Badge className={`${typeInfo.color} border text-xs`}>
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Originally imported: {duplicateInfo.existingCreatedAt 
                          ? format(new Date(duplicateInfo.existingCreatedAt), 'MMM d, yyyy')
                          : 'Unknown'}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{deal.name}</div>
                          <div className="text-xs text-muted-foreground">{deal.email}</div>
                        </div>
                      </div>
                      {deal.companyName && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{deal.companyName}</div>
                            {duplicateInfo.userProfile && (
                              <div className="text-xs text-muted-foreground">
                                Linked to marketplace user
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Current Status:</span>
                      <Badge variant="outline" className="text-xs">
                        {duplicateInfo.existingStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 space-y-3 pt-4 border-t">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-1">
                <div className="font-medium text-blue-900 dark:text-blue-100">
                  All {duplicates.length} records already exist
                </div>
                <div className="text-blue-700 dark:text-blue-300">
                  These contacts have already requested this listing. You can skip all duplicates or review each one individually to merge messages or replace data.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="default"
              onClick={() => {
                onSkipAll();
                onClose();
              }}
              className="w-full"
            >
              Skip All {duplicates.length} Duplicates
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                onReviewIndividually();
                onClose();
              }}
              className="w-full"
            >
              Review Each One Individually
            </Button>
          </div>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
