import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  ListChecks,
  Loader2,
  Building2,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { useContactLists, useCreateContactList, useAddMembersToList } from "@/hooks/admin/use-contact-lists";
import type { CreateContactListMemberInput } from "@/types/contact-list";

export interface DealForList {
  dealId: string;
  dealName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

interface AddDealsToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDeals: DealForList[];
  entityType?: string;
}

type ListMode = "new" | "existing";

export function AddDealsToListDialog({
  open,
  onOpenChange,
  selectedDeals,
  entityType = "deal",
}: AddDealsToListDialogProps) {
  const navigate = useNavigate();
  const [listMode, setListMode] = useState<ListMode>("new");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listType, setListType] = useState<"buyer" | "seller" | "mixed">("seller");

  const { data: existingLists } = useContactLists();
  const createList = useCreateContactList();
  const addMembers = useAddMembersToList();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setListMode("new");
      setSelectedListId("");
    }
  }, [open]);

  const dealsWithContact = selectedDeals.filter((d) => d.contactEmail);
  const dealsWithoutContact = selectedDeals.filter((d) => !d.contactEmail);

  const buildMembers = (): CreateContactListMemberInput[] =>
    dealsWithContact.map((d) => ({
      contact_email: d.contactEmail!,
      contact_name: d.contactName || null,
      contact_phone: d.contactPhone || null,
      contact_company: d.dealName,
      contact_role: null,
      entity_type: entityType,
      entity_id: d.dealId,
    }));

  const handleSubmit = () => {
    const members = buildMembers();
    if (members.length === 0) return;

    if (listMode === "new") {
      createList.mutate(
        { name, description: description || undefined, list_type: listType, members },
        {
          onSuccess: (data) => {
            onOpenChange(false);
            navigate(`/admin/lists/${data.id}`);
          },
        }
      );
    } else {
      addMembers.mutate(
        { listId: selectedListId, members },
        {
          onSuccess: ({ listId }) => {
            onOpenChange(false);
            navigate(`/admin/lists/${listId}`);
          },
        }
      );
    }
  };

  const isPending = createList.isPending || addMembers.isPending;
  const canSubmit =
    dealsWithContact.length > 0 &&
    !isPending &&
    (listMode === "new" ? name.trim().length > 0 : selectedListId.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Add to Contact List
          </DialogTitle>
          <DialogDescription>
            Add {selectedDeals.length} deal{selectedDeals.length !== 1 ? "s" : ""} to a contact list for outreach.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4 py-2">
          {/* Summary */}
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-md bg-muted/50">
            <Badge variant="secondary" className="text-sm">
              {dealsWithContact.length} with contact info
            </Badge>
            {dealsWithoutContact.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {dealsWithoutContact.length} missing contact email
              </Badge>
            )}
          </div>

          {/* Deal list */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Deals</Label>
            <ScrollArea className="h-[160px] border rounded-md">
              <div className="p-2 space-y-0.5">
                {selectedDeals.map((deal) => (
                  <div
                    key={deal.dealId}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${!deal.contactEmail ? "text-muted-foreground" : ""}`}
                  >
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate flex-1">{deal.dealName}</span>
                    <span className="text-xs text-muted-foreground truncate ml-auto max-w-[180px]">
                      {deal.contactEmail || "No contact email"}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* List selection */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={listMode === "new" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setListMode("new")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New List
              </Button>
              <Button
                variant={listMode === "existing" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setListMode("existing")}
                disabled={!existingLists?.length}
              >
                <ListChecks className="h-3.5 w-3.5 mr-1" />
                Existing List {existingLists?.length ? `(${existingLists.length})` : ""}
              </Button>
            </div>

            {listMode === "new" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="deal-list-name">List Name *</Label>
                  <Input
                    id="deal-list-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Q1 Seller Outreach"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-list-desc">Description</Label>
                  <Textarea
                    id="deal-list-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>List Type</Label>
                  <Select value={listType} onValueChange={(v) => setListType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Seller</SelectItem>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Select List</Label>
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingLists?.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.contact_count} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
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
                {listMode === "new" ? "Create List" : "Add to List"} ({dealsWithContact.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
