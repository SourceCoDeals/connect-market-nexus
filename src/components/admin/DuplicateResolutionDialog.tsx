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
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Building2, Mail, Calendar, MessageSquare, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { DuplicateInfo } from '@/hooks/admin/use-bulk-deal-import';

interface DuplicateResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  duplicate: {
    deal: {
      csvRowNumber: number;
      date: Date | null;
      name: string;
      email: string;
      companyName: string;
      message: string;
    };
    duplicateInfo: DuplicateInfo;
  } | null;
  onSkip: () => void;
  onMerge: () => void;
  onReplace: () => void;
  onCreateAnyway: () => void;
}

const getDuplicateTypeLabel = (type: DuplicateInfo['type']): { label: string; color: string } => {
  switch (type) {
    case 'exact_user_and_listing':
      return { label: 'Existing User + Same Listing', color: 'bg-red-100 text-red-800 border-red-200' };
    case 'lead_email_and_listing':
      return { label: 'Same Email + Same Listing', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    case 'same_company_different_email':
      return { label: 'Same Company, Different Email', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 'cross_source_inbound_lead':
      return { label: 'Already Converted from Inbound Lead', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    default:
      return { label: 'Duplicate Detected', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

export function DuplicateResolutionDialog({
  isOpen,
  onClose,
  duplicate,
  onSkip,
  onMerge,
  onReplace,
  onCreateAnyway,
}: DuplicateResolutionDialogProps) {
  if (!duplicate) return null;

  const { deal, duplicateInfo } = duplicate;
  const typeInfo = getDuplicateTypeLabel(duplicateInfo.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <DialogTitle>Duplicate Connection Request Detected</DialogTitle>
          </div>
          <DialogDescription>
            This contact has already requested this listing. Choose how to handle this duplicate.
          </DialogDescription>
        </DialogHeader>

        {/* Duplicate Type Badge */}
        <Badge className={`${typeInfo.color} border w-fit`}>
          {typeInfo.label}
        </Badge>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Existing Request */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Existing Request</h3>
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">Created</div>
                    <div className="text-muted-foreground">
                      {duplicateInfo.existingCreatedAt 
                        ? format(new Date(duplicateInfo.existingCreatedAt), 'PPp')
                        : 'Unknown date'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Badge variant="outline">{duplicateInfo.existingStatus}</Badge>
                </div>

                {duplicateInfo.userProfile && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <div className="font-medium">Linked to User</div>
                        <div className="text-muted-foreground">{duplicateInfo.userProfile.email}</div>
                      </div>
                    </div>
                  </>
                )}

                {duplicateInfo.existingMessage && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <div className="font-medium">Original Message</div>
                        <div className="text-muted-foreground line-clamp-3 mt-1">
                          {duplicateInfo.existingMessage}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* New CSV Entry */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">New CSV Entry (Row {deal.csvRowNumber})</h3>
              <div className="space-y-3 bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">Date</div>
                    <div className="text-muted-foreground">
                      {deal.date ? format(deal.date, 'PPp') : 'No date provided'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">{deal.name}</div>
                    <div className="text-muted-foreground">{deal.email}</div>
                  </div>
                </div>

                {deal.companyName && (
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="font-medium">Company</div>
                      <div className="text-muted-foreground">{deal.companyName}</div>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">New Message</div>
                    <div className="text-muted-foreground line-clamp-3 mt-1">
                      {deal.message}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 border-t">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                onSkip();
                onClose();
              }}
              className="w-full"
            >
              Skip This Entry
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                onMerge();
                onClose();
              }}
              className="w-full"
            >
              Merge Messages (Append)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                onReplace();
                onClose();
              }}
              className="w-full"
            >
              Replace Existing Request
            </Button>

            <Button
              variant="default"
              onClick={() => {
                onCreateAnyway();
                onClose();
              }}
              className="w-full"
            >
              Create New Anyway
            </Button>
          </div>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

