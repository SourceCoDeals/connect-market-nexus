/**
 * AccessMatrixSection.tsx
 *
 * Document status + document access toggles for approved requests,
 * plus the access confirmation dialog.
 */
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Lock, Eye } from 'lucide-react';
import type { AccessField, PendingAccessToggle, AccessRecord } from './types';

interface AccessMatrixSectionProps {
  hasNDA: boolean;
  hasFeeAgreement: boolean;
  accessRecord: AccessRecord | null | undefined;
  requestAccessToggle: (field: AccessField, newValue: boolean) => void;
  isAccessPending: boolean;
  // Confirmation dialog
  pendingAccessToggle: PendingAccessToggle | null;
  setPendingAccessToggle: (toggle: PendingAccessToggle | null) => void;
  confirmAccessToggle: () => void;
  buyerName: string;
}

export function AccessMatrixSection({
  hasNDA,
  hasFeeAgreement,
  accessRecord,
  requestAccessToggle,
  isAccessPending,
  pendingAccessToggle,
  setPendingAccessToggle,
  confirmAccessToggle,
  buyerName,
}: AccessMatrixSectionProps) {
  const getDocStatusDot = (signed: boolean) => (
    <div className={`w-2 h-2 rounded-full ${signed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
            <FileText className="h-3.5 w-3.5" /> Document Status
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
              <span className="text-xs font-medium">NDA</span>
              <div className="flex items-center gap-1.5">
                {getDocStatusDot(hasNDA)}
                <span className="text-xs text-muted-foreground">
                  {hasNDA ? 'Signed' : 'Required'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
              <span className="text-xs font-medium">Fee Agreement</span>
              <div className="flex items-center gap-1.5">
                {getDocStatusDot(hasFeeAgreement)}
                <span className="text-xs text-muted-foreground">
                  {hasFeeAgreement ? 'Signed' : 'Required'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <TooltipProvider>
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <Eye className="h-3.5 w-3.5" /> Document Access
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <span className="text-xs font-medium">Teaser</span>
                <Switch
                  checked={accessRecord?.can_view_teaser ?? false}
                  onCheckedChange={(checked) => requestAccessToggle('can_view_teaser', checked)}
                  disabled={isAccessPending}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">Full Memo</span>
                  {!hasFeeAgreement && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Requires signed fee agreement
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Switch
                  checked={accessRecord?.can_view_full_memo ?? false}
                  onCheckedChange={(checked) =>
                    requestAccessToggle('can_view_full_memo', checked)
                  }
                  disabled={isAccessPending || !hasFeeAgreement}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">Data Room</span>
                  {!hasFeeAgreement && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Requires signed fee agreement
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Switch
                  checked={accessRecord?.can_view_data_room ?? false}
                  onCheckedChange={(checked) =>
                    requestAccessToggle('can_view_data_room', checked)
                  }
                  disabled={isAccessPending || !hasFeeAgreement}
                  className="scale-75"
                />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* ── DOCUMENT ACCESS CONFIRMATION DIALOG ── */}
      <Dialog
        open={!!pendingAccessToggle}
        onOpenChange={(open) => {
          if (!open) setPendingAccessToggle(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {pendingAccessToggle?.newValue ? 'Grant' : 'Revoke'} {pendingAccessToggle?.label}{' '}
              Access?
            </DialogTitle>
            <DialogDescription className="text-sm">
              {pendingAccessToggle?.newValue
                ? `This will allow ${buyerName} to view the ${pendingAccessToggle?.label}.`
                : `This will remove ${buyerName}'s access to the ${pendingAccessToggle?.label}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingAccessToggle(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAccessToggle}
              disabled={isAccessPending}
              className="bg-sourceco hover:bg-sourceco/90 text-sourceco-foreground"
            >
              {pendingAccessToggle?.newValue ? 'Grant Access' : 'Revoke Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
