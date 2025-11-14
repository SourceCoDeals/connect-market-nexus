import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollections, useCreateCollection, useAddToCollection } from '@/hooks/use-collections';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface SaveToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  onSaveComplete?: () => void;
}

export function SaveToCollectionDialog({
  open,
  onOpenChange,
  listingId,
  onSaveComplete,
}: SaveToCollectionDialogProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');

  const { data: collections } = useCollections();
  const { mutate: createCollection, isPending: isCreating } = useCreateCollection();
  const { mutate: addToCollection, isPending: isAdding } = useAddToCollection();

  const handleSave = () => {
    if (mode === 'select' && selectedCollectionId) {
      addToCollection(
        { collectionId: selectedCollectionId, listingId },
        {
          onSuccess: () => {
            onSaveComplete?.();
            onOpenChange(false);
          },
        }
      );
    } else if (mode === 'create' && newCollectionName) {
      createCollection(
        { name: newCollectionName },
        {
          onSuccess: (newCollection) => {
            addToCollection(
              { collectionId: newCollection.id, listingId },
              {
                onSuccess: () => {
                  onSaveComplete?.();
                  setNewCollectionName('');
                  onOpenChange(false);
                },
              }
            );
          },
        }
      );
    }
  };

  const isPending = isCreating || isAdding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save to collection</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Organize this listing in a collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {collections && collections.length > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-4">
                <Button
                  variant={mode === 'select' ? 'default' : 'outline'}
                  onClick={() => setMode('select')}
                  size="sm"
                  className={mode === 'select' ? 'bg-foreground text-background' : ''}
                >
                  Existing
                </Button>
                <Button
                  variant={mode === 'create' ? 'default' : 'outline'}
                  onClick={() => setMode('create')}
                  size="sm"
                  className={mode === 'create' ? 'bg-foreground text-background' : ''}
                >
                  New collection
                </Button>
              </div>

              {mode === 'select' && (
                <RadioGroup value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {collections.map((collection) => (
                      <div
                        key={collection.id}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedCollectionId(collection.id)}
                      >
                        <RadioGroupItem value={collection.id} id={collection.id} />
                        <Label
                          htmlFor={collection.id}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{collection.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {collection.item_count || 0} {collection.item_count === 1 ? 'listing' : 'listings'}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}

              {mode === 'create' && (
                <div className="space-y-2">
                  <Label htmlFor="collection-name" className="text-sm font-medium">
                    Collection name
                  </Label>
                  <Input
                    id="collection-name"
                    placeholder="e.g., Tech Companies, California Deals"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="collection-name" className="text-sm font-medium">
                Collection name
              </Label>
              <Input
                id="collection-name"
                placeholder="e.g., Tech Companies, California Deals"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isPending ||
                (mode === 'select' && !selectedCollectionId) ||
                (mode === 'create' && !newCollectionName)
              }
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
