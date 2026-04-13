import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Copy, Loader2 } from 'lucide-react';
import { usePortalOrganizations } from '@/hooks/portal/use-portal-organizations';
import { usePortalThesisCriteria, useCloneThesisCriteria } from '@/hooks/portal/use-portal-thesis';

interface CloneThesisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Portal org that will RECEIVE the cloned criteria. */
  targetPortalOrgId: string;
}

export function CloneThesisDialog({
  open,
  onOpenChange,
  targetPortalOrgId,
}: CloneThesisDialogProps) {
  const [sourcePortalOrgId, setSourcePortalOrgId] = useState('');

  const { data: orgs, isLoading: orgsLoading } = usePortalOrganizations();
  const { data: sourceCriteria } = usePortalThesisCriteria(sourcePortalOrgId || undefined);
  const cloneMutation = useCloneThesisCriteria();

  // Exclude the target portal from the source dropdown, and only show orgs
  // that have at least one active criterion.
  const candidateOrgs = (orgs ?? []).filter((o) => o.id !== targetPortalOrgId);
  const activeCount = sourceCriteria?.filter((c) => c.is_active).length ?? 0;

  const handleClone = () => {
    if (!sourcePortalOrgId) return;
    cloneMutation.mutate(
      { sourcePortalOrgId, targetPortalOrgId },
      {
        onSuccess: () => {
          setSourcePortalOrgId('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!cloneMutation.isPending) {
          setSourcePortalOrgId('');
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Thesis from Another Portal
          </DialogTitle>
          <DialogDescription>
            Copy all active thesis criteria from another portal client to this one. Existing
            criteria on this portal are not deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Source Portal</Label>
            {orgsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : candidateOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other portals available to clone from.
              </p>
            ) : (
              <Select
                value={sourcePortalOrgId}
                onValueChange={setSourcePortalOrgId}
                disabled={cloneMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a portal to copy from..." />
                </SelectTrigger>
                <SelectContent>
                  {candidateOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {sourcePortalOrgId && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {activeCount === 0
                  ? 'Selected portal has no active criteria to clone.'
                  : `Will copy ${activeCount} active ${activeCount === 1 ? 'criterion' : 'criteria'}. Portfolio buyer links are preserved.`}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cloneMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={!sourcePortalOrgId || activeCount === 0 || cloneMutation.isPending}
          >
            {cloneMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Clone {activeCount > 0 ? `${activeCount} Criteria` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
