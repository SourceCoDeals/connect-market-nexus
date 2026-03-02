import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, User, UserPlus } from 'lucide-react';
import type { DataRoomAccessRecord } from '@/hooks/admin/data-room/use-data-room';
import type { UnifiedBuyer } from './useAccessMatrix';

interface AddAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerSearch: string;
  onBuyerSearchChange: (value: string) => void;
  availableBuyers: UnifiedBuyer[];
  activeRecords: DataRoomAccessRecord[];
  addBuyerSelected: Set<string>;
  onAddBuyerSelectedChange: (next: Set<string>) => void;
  onAddBuyers: () => void;
}

export function AddAccessDialog({
  open,
  onOpenChange,
  buyerSearch,
  onBuyerSearchChange,
  availableBuyers,
  activeRecords,
  addBuyerSelected,
  onAddBuyerSelectedChange,
  onAddBuyers,
}: AddAccessDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          onAddBuyerSelectedChange(new Set());
          onBuyerSearchChange('');
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Buyers to Data Room</DialogTitle>
          <DialogDescription>
            Select buyers or contacts to grant initial teaser access. Full memo and data room
            access requires a signed fee agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by company, firm, or contact name..."
            value={buyerSearch}
            onChange={(e) => onBuyerSearchChange(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-1">
            {availableBuyers.map((buyer) => {
              const alreadyAdded = activeRecords.some(
                (r) => r.remarketing_buyer_id === buyer.remarketing_buyer_id,
              );
              const isSelected = addBuyerSelected.has(buyer.id);
              const typeLabel =
                buyer.buyer_type?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
                null;
              return (
                <button
                  key={buyer.id}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-3
                    ${alreadyAdded ? 'opacity-50 cursor-not-allowed bg-muted' : isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent cursor-pointer'}`}
                  onClick={() => {
                    if (alreadyAdded) return;
                    const next = new Set(addBuyerSelected);
                    if (next.has(buyer.id)) next.delete(buyer.id);
                    else next.add(buyer.id);
                    onAddBuyerSelectedChange(next);
                  }}
                  disabled={alreadyAdded}
                >
                  <Checkbox
                    checked={isSelected || alreadyAdded}
                    disabled={alreadyAdded}
                    className="pointer-events-none"
                  />
                  <div className="flex-shrink-0">
                    {buyer.entry_type === 'contact' ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{buyer.display_name}</p>
                      {typeLabel && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 flex-shrink-0"
                        >
                          {typeLabel}
                        </Badge>
                      )}
                    </div>
                    {buyer.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{buyer.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {buyer.has_fee_agreement && (
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0"
                      >
                        Fee Agmt
                      </Badge>
                    )}
                    {alreadyAdded && (
                      <Badge variant="secondary" className="text-xs">
                        Added
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
            {availableBuyers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {buyerSearch ? 'No buyers match your search' : 'No buyers found'}
              </p>
            )}
          </div>
          {addBuyerSelected.size > 0 && (
            <p className="text-xs text-muted-foreground">
              {addBuyerSelected.size} buyer(s) selected
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAddBuyers} disabled={addBuyerSelected.size === 0}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add {addBuyerSelected.size > 0 ? `${addBuyerSelected.size} Buyer(s)` : 'Buyers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
