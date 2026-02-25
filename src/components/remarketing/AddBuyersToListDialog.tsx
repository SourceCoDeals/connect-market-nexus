import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContactLists, useCreateContactList, useAddMembersToList } from "@/hooks/admin/use-contact-lists";
import type { CreateContactListMemberInput } from "@/types/contact-list";

interface BuyerContactInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_primary_at_firm: boolean | null;
}

interface SelectedBuyer {
  buyerId: string;
  companyName: string;
  scoreId?: string;
}

interface AddBuyersToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBuyers: SelectedBuyer[];
}

type ListMode = "new" | "existing";

export function AddBuyersToListDialog({
  open,
  onOpenChange,
  selectedBuyers,
}: AddBuyersToListDialogProps) {
  const navigate = useNavigate();
  const [listMode, setListMode] = useState<ListMode>("existing");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [name, setName] = useState("");

  // Contact data
  const [contactsByBuyer, setContactsByBuyer] = useState<Record<string, BuyerContactInfo[]>>({});
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  // Only track expanded state for multi-contact companies
  const [expandedBuyers, setExpandedBuyers] = useState<Set<string>>(new Set());

  const { data: existingLists } = useContactLists();
  const createList = useCreateContactList();
  const addMembers = useAddMembersToList();

  // Stable key for buyer list to avoid re-fetch on every render
  const buyerKey = selectedBuyers.map((b) => b.buyerId).sort().join(",");
  const fetchIdRef = useRef(0);

  // Default to "existing" when lists are available, fall back to "new" if none
  useEffect(() => {
    if (open && existingLists) {
      setListMode(existingLists.length > 0 ? "existing" : "new");
    }
  }, [open, existingLists]);

  // Fetch contacts for all selected buyers when dialog opens
  useEffect(() => {
    if (!open || selectedBuyers.length === 0) return;

    const fetchId = ++fetchIdRef.current;

    const fetchContacts = async () => {
      setIsLoadingContacts(true);
      const buyerIds = selectedBuyers.map((b) => b.buyerId);
      const contactMap: Record<string, BuyerContactInfo[]> = {};

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, title, is_primary_at_firm, remarketing_buyer_id")
        .in("remarketing_buyer_id", buyerIds)
        .eq("contact_type", "buyer")
        .eq("archived", false)
        .order("is_primary_at_firm", { ascending: false });

      // Abort if dialog closed or buyers changed during fetch
      if (fetchId !== fetchIdRef.current) return;

      for (const buyer of selectedBuyers) {
        contactMap[buyer.buyerId] = [];
      }
      for (const c of contacts || []) {
        const buyerId = (c as any).remarketing_buyer_id;
        if (buyerId && contactMap[buyerId]) {
          contactMap[buyerId].push(c as BuyerContactInfo);
        }
      }

      setContactsByBuyer(contactMap);

      // Auto-select all contacts with email
      const preSelected = new Set<string>();
      for (const buyer of selectedBuyers) {
        for (const contact of contactMap[buyer.buyerId] || []) {
          if (contact.email) {
            preSelected.add(contact.id);
          }
        }
      }
      setSelectedContactIds(preSelected);
      setIsLoadingContacts(false);
    };

    fetchContacts();
  }, [open, buyerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedListId("");
      setContactsByBuyer({});
      setSelectedContactIds(new Set());
      setExpandedBuyers(new Set());
    }
  }, [open]);

  const summary = useMemo(() => {
    let selectedContacts = 0;
    let companiesWithContacts = 0;
    let companiesWithoutContacts = 0;
    let multiContactCompanies = 0;
    let withPhone = 0;

    for (const buyer of selectedBuyers) {
      const contacts = contactsByBuyer[buyer.buyerId] || [];
      const withEmail = contacts.filter((c) => c.email);
      if (withEmail.length > 0) {
        companiesWithContacts++;
        if (withEmail.length > 1) multiContactCompanies++;
      } else {
        companiesWithoutContacts++;
      }
      for (const c of contacts) {
        if (selectedContactIds.has(c.id)) {
          selectedContacts++;
          if (c.phone) withPhone++;
        }
      }
    }

    return { selectedContacts, companiesWithContacts, companiesWithoutContacts, multiContactCompanies, withPhone };
  }, [selectedBuyers, contactsByBuyer, selectedContactIds]);

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const toggleAllContactsForBuyer = (buyerId: string, checked: boolean) => {
    const contacts = contactsByBuyer[buyerId] || [];
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      for (const c of contacts) {
        if (c.email) {
          if (checked) next.add(c.id);
          else next.delete(c.id);
        }
      }
      return next;
    });
  };

  const buildMembers = (): CreateContactListMemberInput[] => {
    const members: CreateContactListMemberInput[] = [];
    for (const buyer of selectedBuyers) {
      const contacts = contactsByBuyer[buyer.buyerId] || [];
      for (const c of contacts) {
        if (!selectedContactIds.has(c.id) || !c.email) continue;
        members.push({
          contact_email: c.email,
          contact_name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
          contact_phone: c.phone,
          contact_company: buyer.companyName,
          contact_role: c.title,
          entity_type: "remarketing_buyer",
          entity_id: buyer.buyerId,
        });
      }
    }
    return members;
  };

  const handleSubmit = () => {
    const members = buildMembers();
    if (members.length === 0) return;

    if (listMode === "new") {
      createList.mutate(
        { name, list_type: "buyer", members },
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
    summary.selectedContacts > 0 &&
    !isPending &&
    (listMode === "new" ? name.trim().length > 0 : selectedListId.length > 0);

  const formatContactName = (c: BuyerContactInfo) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Add to Contact List
          </DialogTitle>
          <DialogDescription>
            Add contacts from {selectedBuyers.length} {selectedBuyers.length === 1 ? "company" : "companies"} to a list for outreach.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4 py-2">
          {/* Summary */}
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-md bg-muted/50">
            <Badge variant="secondary" className="text-sm">
              {summary.selectedContacts} contact{summary.selectedContacts !== 1 ? "s" : ""} selected
            </Badge>
            <span className="text-xs text-muted-foreground">
              {summary.withPhone} with phone
            </span>
            {summary.companiesWithoutContacts > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {summary.companiesWithoutContacts} with no contacts
              </Badge>
            )}
          </div>

          {/* Company/Contact list — compact for single contacts, expandable for multi */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Companies &amp; Contacts</Label>
            <ScrollArea className="h-[180px] border rounded-md">
              {isLoadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading contacts...</span>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {selectedBuyers.map((buyer) => {
                    const contacts = contactsByBuyer[buyer.buyerId] || [];
                    const contactsWithEmail = contacts.filter((c) => c.email);
                    const hasMultiple = contactsWithEmail.length > 1;
                    const isExpanded = expandedBuyers.has(buyer.buyerId);

                    // No contacts
                    if (contacts.length === 0) {
                      return (
                        <div key={buyer.buyerId} className="flex items-center gap-2 px-3 py-1.5 rounded text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="text-sm flex-1 truncate">{buyer.companyName}</span>
                          <span className="text-xs italic">No contacts</span>
                        </div>
                      );
                    }

                    // Single contact (most common) — compact inline row
                    if (!hasMultiple) {
                      const contact = contactsWithEmail[0] || contacts[0];
                      const hasEmail = !!contact?.email;
                      return (
                        <label
                          key={buyer.buyerId}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded hover:bg-muted/50 cursor-pointer ${!hasEmail ? "opacity-50" : ""}`}
                        >
                          <Checkbox
                            checked={hasEmail && selectedContactIds.has(contact.id)}
                            onCheckedChange={() => hasEmail && toggleContact(contact.id)}
                            disabled={!hasEmail}
                          />
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{buyer.companyName}</span>
                          <span className="text-xs text-muted-foreground truncate ml-auto">
                            {hasEmail ? formatContactName(contact) : "No email"}
                          </span>
                        </label>
                      );
                    }

                    // Multiple contacts — expandable
                    const selectedCount = contactsWithEmail.filter((c) => selectedContactIds.has(c.id)).length;
                    return (
                      <div key={buyer.buyerId} className="border rounded">
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedBuyers((prev) => {
                              const next = new Set(prev);
                              if (next.has(buyer.buyerId)) next.delete(buyer.buyerId);
                              else next.add(buyer.buyerId);
                              return next;
                            })
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium flex-1 truncate">{buyer.companyName}</span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {selectedCount}/{contactsWithEmail.length}
                            </Badge>
                            <Checkbox
                              checked={selectedCount === contactsWithEmail.length}
                              onCheckedChange={(checked) => toggleAllContactsForBuyer(buyer.buyerId, !!checked)}
                            />
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t bg-muted/20 py-0.5">
                            {contacts.map((contact) => {
                              const hasEmail = !!contact.email;
                              return (
                                <label
                                  key={contact.id}
                                  className={`flex items-center gap-2 px-3 py-1 pl-9 hover:bg-muted/30 cursor-pointer text-sm ${!hasEmail ? "opacity-50" : ""}`}
                                >
                                  <Checkbox
                                    checked={selectedContactIds.has(contact.id)}
                                    onCheckedChange={() => toggleContact(contact.id)}
                                    disabled={!hasEmail}
                                  />
                                  <span className="truncate">{formatContactName(contact)}</span>
                                  {contact.is_primary_at_firm && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Primary</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground truncate ml-auto">
                                    {hasEmail ? contact.email : "No email"}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
              >
                <ListChecks className="h-3.5 w-3.5 mr-1" />
                Existing List {existingLists?.length ? `(${existingLists.length})` : ""}
              </Button>
            </div>

            {listMode === "new" ? (
              <div className="space-y-1.5">
                <Label htmlFor="list-name-new">List Name *</Label>
                <Input
                  id="list-name-new"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., HVAC Buyers - Colorado Deal"
                />
              </div>
            ) : existingLists?.length ? (
              <div className="space-y-1.5">
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
              <p className="text-sm text-muted-foreground py-2">No lists yet. Switch to "New List" to create one.</p>
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
                {listMode === "new" ? "Create List" : "Add to List"} ({summary.selectedContacts})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
