import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Loader2 } from "lucide-react";
import { useCreateContactList } from "@/hooks/admin/use-contact-lists";
import type { NonMarketplaceUser, NonMarketplaceUserFilters } from "@/types/non-marketplace-user";
import type { ContactListFilterSnapshot, CreateContactListMemberInput } from "@/types/contact-list";

interface SaveAsListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: NonMarketplaceUser[];
  filters?: NonMarketplaceUserFilters;
  onSuccess?: (listId: string) => void;
}

export function SaveAsListModal({
  open,
  onOpenChange,
  selectedUsers,
  filters,
  onSuccess,
}: SaveAsListModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listType, setListType] = useState<"buyer" | "seller" | "mixed">("buyer");
  const [tags, setTags] = useState("");

  const createList = useCreateContactList();

  const handleCreate = () => {
    const members: CreateContactListMemberInput[] = selectedUsers.map((u) => ({
      contact_email: u.email,
      contact_name: u.name,
      contact_phone: u.phone,
      contact_company: u.company,
      contact_role: u.role,
      entity_type: u.source,
      entity_id: u.source_id,
    }));

    const filterSnapshot: ContactListFilterSnapshot | undefined = filters
      ? { page: "buyer_contacts", ...filters }
      : undefined;

    const tagsList = tags
      .split(",")
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
          setName("");
          setDescription("");
          setTags("");
          onOpenChange(false);
          onSuccess?.(data.id);
          navigate(`/admin/lists/${data.id}`);
        },
      }
    );
  };

  const withPhone = selectedUsers.filter((u) => u.phone).length;
  const withEmail = selectedUsers.filter((u) => u.email).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Save as List
          </DialogTitle>
          <DialogDescription>
            Create a reusable contact list from your selection. Lists can be exported to PhoneBurner or CSV.
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
            <Select value={listType} onValueChange={(v) => setListType(v as "buyer" | "seller" | "mixed")}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createList.isPending}
          >
            {createList.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ListChecks className="mr-2 h-4 w-4" />
                Save List
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
