import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, UserCog, Archive, ArrowRightLeft, ListChecks, Loader2 } from 'lucide-react';
import { useUpdateDeal, useSoftDeleteDeal, useUpdateDealStage } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { toast } from 'sonner';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { AddDealsToListDialog } from '@/components/remarketing/AddDealsToListDialog';
import type { DealForList } from '@/components/remarketing/AddDealsToListDialog';

interface BulkActionsDropdownProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function BulkActionsDropdown({ pipeline }: BulkActionsDropdownProps) {
  const { selectedDeals, setSelectedDeals, stages, deals } = pipeline;
  const { data: adminProfiles } = useAdminProfiles();
  const updateDeal = useUpdateDeal();
  const softDelete = useSoftDeleteDeal();
  const updateStage = useUpdateDealStage();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);

  const dealsForList: DealForList[] = selectedDeals.map((id) => {
    const deal = deals.find((d) => d.deal_id === id);
    return {
      dealId: id,
      dealName: deal?.listing_title || deal?.title || 'Unknown Deal',
      contactName: deal?.contact_name ?? null,
      contactEmail: deal?.contact_email ?? null,
      contactPhone: deal?.contact_phone ?? null,
    };
  });
  const [targetOwner, setTargetOwner] = useState<string>('');
  const [targetStage, setTargetStage] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  const count = selectedDeals.length;

  const runBulk = async (work: (dealId: string) => Promise<unknown>, successMsg: string) => {
    setIsRunning(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedDeals) {
      try {
        await work(id);
        ok += 1;
      } catch (err) {
        console.error('Bulk action failed for deal', id, err);
        fail += 1;
      }
    }
    setIsRunning(false);
    if (fail === 0) {
      toast.success(`${successMsg} (${ok}/${count})`);
    } else {
      toast.error(`${ok} succeeded, ${fail} failed`);
    }
    setSelectedDeals([]);
  };

  const handleReassign = async () => {
    if (!targetOwner) return;
    await runBulk(
      (dealId) =>
        updateDeal.mutateAsync({
          dealId,
          updates: { assigned_to: targetOwner === 'unassigned' ? null : targetOwner },
        }),
      'Reassigned',
    );
    setReassignOpen(false);
    setTargetOwner('');
  };

  const handleMoveStage = async () => {
    if (!targetStage) return;
    const stage = stages.find((s) => s.id === targetStage);
    await runBulk((dealId) => {
      const deal = deals.find((d) => d.deal_id === dealId);
      return updateStage.mutateAsync({
        dealId,
        stageId: targetStage,
        fromStage: deal?.stage_name || undefined,
        toStage: stage?.name,
        skipOwnerCheck: true,
      });
    }, 'Moved');
    setMoveStageOpen(false);
    setTargetStage('');
  };

  const handleArchive = async () => {
    await runBulk(
      (dealId) => softDelete.mutateAsync({ dealId, reason: 'Bulk archived from pipeline' }),
      'Archived',
    );
    setArchiveOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Bulk Actions
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[100] bg-background">
          <DropdownMenuLabel>{count} selected</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setReassignOpen(true)}>
            <UserCog className="h-4 w-4 mr-2" />
            Reassign owner…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveStageOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Move to stage…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAddToListOpen(true)}>
            <ListChecks className="h-4 w-4 mr-2" />
            Add to list…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive deals…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reassign {count} deal{count === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Select the admin that should become the new deal owner.
            </DialogDescription>
          </DialogHeader>
          <Select value={targetOwner} onValueChange={setTargetOwner}>
            <SelectTrigger>
              <SelectValue placeholder="Choose owner…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {adminProfiles &&
                Object.values(adminProfiles).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.displayName || admin.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!targetOwner || isRunning}>
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move stage dialog */}
      <Dialog open={moveStageOpen} onOpenChange={setMoveStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {count} deal{count === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>Select the destination stage.</DialogDescription>
          </DialogHeader>
          <Select value={targetStage} onValueChange={setTargetStage}>
            <SelectTrigger>
              <SelectValue placeholder="Choose stage…" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveStageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveStage} disabled={!targetStage || isRunning}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {count} deal{count === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived deals can be restored from the deleted items view. Deal history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isRunning}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to list */}
      <AddDealsToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        selectedDeals={dealsForList}
        entityType="deal"
      />
    </>
  );
}
