import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { ListChecks, Loader2, Plus } from 'lucide-react';
import {
  useContactLists,
  useCreateContactList,
  useAddMembersToList,
} from '@/hooks/admin/use-contact-lists';
import type { NonMarketplaceUser, NonMarketplaceUserFilters } from '@/types/non-marketplace-user';
import type { ContactListFilterSnapshot, CreateContactListMemberInput } from '@/types/contact-list';

interface SaveAsListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: NonMarketplaceUser[];
  filters?: NonMarketplaceUserFilters;
  onSuccess?: (listId: string) => void;
}

type ListMode = 'new' | 'existing';

export function SaveAsListModal({
  open,
  onOpenChange,
  selectedUsers,
  filters,
  onSuccess,
}: SaveAsListModalProps) {
  const navigate = useNavigate();
  const [listMode, setListMode] = useState<ListMode>('new');
  const [selectedListId, setSelectedListId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState<'buyer' | 'seller' | 'mixed'>('buyer');
  const [tags, setTags] = useState('');

  const { data: allLists } = useContactLists();
  const createList = useCreateContactList();
  const addMembers = useAddMembersToList();

  // Only show buyer and mixed lists in the picker
  const existingLists = useMemo(
    () => allLists?.filter((l) => l.list_type === 'buyer' || l.list_type === 'mixed'),
    [allLists],
  );

  // Default to "existing" when lists are available
  useEffect(() => {
    if (open && existingLists) {
      setListMode(existingLists.length > 0 ? 'existing' : 'new');
    }
  }, [open, existingLists]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setTags('');
      setSelectedListId('');
    }
  }, [open]);

  const buildMembers = (): CreateContactListMemberInput[] =>
    selectedUsers
      .filter((u) => u.email)
      .map((u) => ({
        contact_email: u.email,
        contact_name: u.name,
        contact_phone: u.phone,
        contact_company: u.company,
        contact_role: u.role,
        entity_type: u.source,
        entity_id: u.source_id,
      }));

  const handleSubmit = () => {
    const members = buildMembers();
    if (members.length === 0) return;

    if (listMode === 'new') {
      const filterSnapshot: ContactListFilterSnapshot | undefined = filters
        ? { page: 'buyer_contacts', ...filters }
        : undefined;

      const tagsList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      createList.mutate(
        {
          name,
          description: description || undefined,
          list_type: listType,
          tags: tagsList,
          filter_snapshot: filterSnapshot,
          members,
        },
        {
          onSuccess: (data) => {
            onOpenChange(false);
            onSuccess?.(data.id);
            navigate(`/admin/lists/${data.id}`);
          },
        },
      );
    } else {
      addMembers.mutate(
        { listId: selectedListId, members },
        {
          onSuccess: ({ listId }) => {
            onOpenChange(false);
            onSuccess?.(listId);
            navigate(`/admin/lists/${listId}`);
          },
        },
      );
    }
  };

  const withPhone = selectedUsers.filter((u) => u.phone).length;
  const withEmail = selectedUsers.filter((u) => u.email).length;
  const isPending = createList.isPending || addMembers.isPending;
  const canSubmit =
    withEmail > 0 &&
    !isPending &&
    (listMode === 'new' ? name.trim().length > 0 : selectedListId.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {listMode === 'new' ? 'Save as List' : 'Add to List'}
          </DialogTitle>
          <DialogDescription>
            {listMode === 'new'
              ? 'Create a reusable contact list from your selection.'
              : 'Add selected contacts to an existing list.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <Badge variant="secondary" className="text-sm">
              {selectedUsers.length} contacts
            </Badge>
            <span className="text-xs text-muted-foreground">
              {withPhone} with phone &middot; {withEmail} with email
            </span>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={listMode === 'new' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setListMode('new')}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New List
            </Button>
            <Button
              variant={listMode === 'existing' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setListMode('existing')}
            >
              <ListChecks className="h-3.5 w-3.5 mr-1" />
              Existing List {existingLists?.length ? `(${existingLists.length})` : ''}
            </Button>
          </div>

          {listMode === 'new' ? (
            <>
              {/* List Name */}
              <div className="space-y-2">
                <Label htmlFor="list-name">List Name *</Label>
                <Input
                  id="list-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Collision Buyers - No Fee Agmt"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="list-desc">Description</Label>
                <Textarea
                  id="list-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this list..."
                  rows={2}
                />
              </div>

              {/* List Type */}
              <div className="space-y-2">
                <Label>List Type</Label>
                <Select
                  value={listType}
                  onValueChange={(v) => setListType(v as 'buyer' | 'seller' | 'mixed')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="list-tags">Tags (comma-separated)</Label>
                <Input
                  id="list-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., collision, outbound, no-fee"
                />
              </div>
            </>
          ) : existingLists?.length ? (
            <div className="space-y-2">
              <Label>Select List</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list..." />
                </SelectTrigger>
                <SelectContent>
                  {existingLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.contact_count} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No buyer lists yet. Switch to "New List" to create one.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ListChecks className="mr-2 h-4 w-4" />
                {listMode === 'new' ? 'Save List' : `Add to List (${withEmail})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
