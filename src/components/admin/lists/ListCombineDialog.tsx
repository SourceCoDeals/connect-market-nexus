import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Merge, Minus, Filter } from 'lucide-react';
import {
  useMergeLists,
  useSubtractLists,
  useIntersectLists,
} from '@/hooks/admin/use-list-operations';

export type ListOperation = 'merge' | 'subtract' | 'intersect';

interface SelectedList {
  id: string;
  name: string;
  contact_count: number;
  list_type: string;
}

interface ListCombineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLists: SelectedList[];
  defaultOperation?: ListOperation;
}

const OPERATION_INFO: Record<
  ListOperation,
  { label: string; description: string; icon: typeof Merge }
> = {
  merge: {
    label: 'Merge',
    description: 'Combine all contacts, deduplicated by email.',
    icon: Merge,
  },
  subtract: {
    label: 'Subtract',
    description: 'Take the primary list and remove contacts that appear in the other lists.',
    icon: Minus,
  },
  intersect: {
    label: 'Intersect',
    description: 'Keep only contacts that appear in ALL selected lists.',
    icon: Filter,
  },
};

export function ListCombineDialog({
  open,
  onOpenChange,
  selectedLists,
  defaultOperation = 'merge',
}: ListCombineDialogProps) {
  const [operation, setOperation] = useState<ListOperation>(defaultOperation);
  const [name, setName] = useState('');
  const [primaryId, setPrimaryId] = useState('');

  const mergeLists = useMergeLists();
  const subtractLists = useSubtractLists();
  const intersectLists = useIntersectLists();

  useEffect(() => {
    if (open) {
      setOperation(defaultOperation);
      setName('');
      setPrimaryId(selectedLists[0]?.id ?? '');
    }
  }, [open, defaultOperation, selectedLists]);

  const listType = selectedLists[0]?.list_type ?? 'mixed';
  const listIds = selectedLists.map((l) => l.id);
  const isPending = mergeLists.isPending || subtractLists.isPending || intersectLists.isPending;

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (operation === 'merge') {
      mergeLists.mutate({ listIds, name, listType }, { onSuccess: () => onOpenChange(false) });
    } else if (operation === 'subtract') {
      const excludeIds = listIds.filter((id) => id !== primaryId);
      subtractLists.mutate(
        { primaryId, excludeIds, name },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      intersectLists.mutate({ listIds, name, listType }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const info = OPERATION_INFO[operation];
  const Icon = info.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {info.label} Lists
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selected lists */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Selected Lists</Label>
            <div className="space-y-1">
              {selectedLists.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded bg-muted/50"
                >
                  <span className="font-medium truncate flex-1">{l.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {l.contact_count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Operation picker */}
          <div className="space-y-2">
            <Label>Operation</Label>
            <RadioGroup
              value={operation}
              onValueChange={(v) => setOperation(v as ListOperation)}
              className="flex gap-4"
            >
              {(['merge', 'subtract', 'intersect'] as const).map((op) => (
                <div key={op} className="flex items-center space-x-2">
                  <RadioGroupItem value={op} id={`op-${op}`} />
                  <Label htmlFor={`op-${op}`} className="cursor-pointer text-sm">
                    {OPERATION_INFO[op].label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Primary list picker for subtract */}
          {operation === 'subtract' && selectedLists.length > 1 && (
            <div className="space-y-2">
              <Label>Primary List (keep contacts from)</Label>
              <Select value={primaryId} onValueChange={setPrimaryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose primary list..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedLists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.contact_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Contacts from the other {selectedLists.length - 1} list
                {selectedLists.length - 1 !== 1 ? 's' : ''} will be excluded.
              </p>
            </div>
          )}

          {/* New list name */}
          <div className="space-y-2">
            <Label htmlFor="combine-name">New List Name *</Label>
            <Input
              id="combine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g., ${info.label}d — ${selectedLists.map((l) => l.name).join(' + ')}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Icon className="mr-2 h-4 w-4" />
                {info.label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
