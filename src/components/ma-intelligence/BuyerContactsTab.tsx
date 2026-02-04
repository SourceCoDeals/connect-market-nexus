import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Linkedin,
  FileText,
} from "lucide-react";

interface BuyerContact {
  id: string;
  buyer_id: string;
  name: string;
  title: string | null;
  company_type: "PE Firm" | "Platform" | "Other" | null;
  priority_level: number | null;
  email: string | null;
  email_confidence: string | null;
  phone: string | null;
  linkedin_url: string | null;
  is_deal_team: boolean | null;
  is_primary_contact: boolean | null;
  last_contacted_date: string | null;
  fee_agreement_status: string | null;
  salesforce_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BuyerContactsTabProps {
  buyerId: string;
}

export function BuyerContactsTab({ buyerId }: BuyerContactsTabProps) {
  const [contacts, setContacts] = useState<BuyerContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<BuyerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCSVDialogOpen, setIsCSVDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<BuyerContact | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    company_type: "PE Firm" as "PE Firm" | "Platform" | "Other",
    priority_level: 2,
    email: "",
    email_confidence: "medium",
    phone: "",
    linkedin_url: "",
    is_deal_team: false,
    is_primary_contact: false,
    fee_agreement_status: "",
    salesforce_id: "",
    notes: "",
  });

  useEffect(() => {
    loadContacts();
  }, [buyerId]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.title?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.company_type?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("buyer_contacts")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading contacts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!formData.name || !formData.email) {
      toast({
        title: "Missing information",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("buyer_contacts").insert({
        buyer_id: buyerId,
        name: formData.name,
        title: formData.title || null,
        company_type: formData.company_type,
        priority_level: formData.priority_level,
        email: formData.email,
        email_confidence: formData.email_confidence,
        phone: formData.phone || null,
        linkedin_url: formData.linkedin_url || null,
        is_deal_team: formData.is_deal_team,
        is_primary_contact: formData.is_primary_contact,
        fee_agreement_status: formData.fee_agreement_status || null,
        salesforce_id: formData.salesforce_id || null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Contact added",
        description: "The contact has been added successfully",
      });

      resetForm();
      setIsAddDialogOpen(false);
      loadContacts();
    } catch (error: any) {
      toast({
        title: "Error adding contact",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;

    try {
      const { error } = await supabase
        .from("buyer_contacts")
        .update({
          name: formData.name,
          title: formData.title || null,
          company_type: formData.company_type,
          priority_level: formData.priority_level,
          email: formData.email,
          email_confidence: formData.email_confidence,
          phone: formData.phone || null,
          linkedin_url: formData.linkedin_url || null,
          is_deal_team: formData.is_deal_team,
          is_primary_contact: formData.is_primary_contact,
          fee_agreement_status: formData.fee_agreement_status || null,
          salesforce_id: formData.salesforce_id || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingContact.id);

      if (error) throw error;

      toast({
        title: "Contact updated",
        description: "The contact has been updated successfully",
      });

      resetForm();
      setEditingContact(null);
      setIsAddDialogOpen(false);
      loadContacts();
    } catch (error: any) {
      toast({
        title: "Error updating contact",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("buyer_contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      toast({
        title: "Contact deleted",
        description: "The contact has been deleted successfully",
      });

      loadContacts();
    } catch (error: any) {
      toast({
        title: "Error deleting contact",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditContact = (contact: BuyerContact) => {
    setFormData({
      name: contact.name,
      title: contact.title || "",
      company_type: contact.company_type || "PE Firm",
      priority_level: contact.priority_level || 2,
      email: contact.email || "",
      email_confidence: contact.email_confidence || "medium",
      phone: contact.phone || "",
      linkedin_url: contact.linkedin_url || "",
      is_deal_team: contact.is_deal_team || false,
      is_primary_contact: contact.is_primary_contact || false,
      fee_agreement_status: contact.fee_agreement_status || "",
      salesforce_id: contact.salesforce_id || "",
      notes: contact.notes || "",
    });
    setEditingContact(contact);
    setIsAddDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      title: "",
      company_type: "PE Firm",
      priority_level: 2,
      email: "",
      email_confidence: "medium",
      phone: "",
      linkedin_url: "",
      is_deal_team: false,
      is_primary_contact: false,
      fee_agreement_status: "",
      salesforce_id: "",
      notes: "",
    });
  };

  const getPriorityBadgeVariant = (level: number | null) => {
    switch (level) {
      case 1:
        return "default";
      case 2:
        return "secondary";
      case 3:
        return "outline";
      case 4:
        return "outline";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCSVDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setEditingContact(null);
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Contacts Table */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No contacts found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add your first contact
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Contact Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.title || "—"}
                  </TableCell>
                  <TableCell>
                    {contact.company_type && (
                      <Badge variant="outline">{contact.company_type}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.priority_level && (
                      <Badge variant={getPriorityBadgeVariant(contact.priority_level)}>
                        P{contact.priority_level}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      {contact.email_confidence && (
                        <Badge variant="outline" className="text-xs">
                          {contact.email_confidence}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {contact.is_primary_contact && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      {contact.is_deal_team && (
                        <Badge variant="secondary" className="text-xs">
                          Deal Team
                        </Badge>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <Linkedin className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setEditingContact(null);
          }
          setIsAddDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Add Contact"}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? "Update contact information"
                : "Add a new contact for this buyer"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_type">Company Type</Label>
                <Select
                  value={formData.company_type}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, company_type: value })
                  }
                >
                  <SelectTrigger id="company_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PE Firm">PE Firm</SelectItem>
                    <SelectItem value="Platform">Platform</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority_level">Priority Level</Label>
                <Select
                  value={formData.priority_level.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority_level: parseInt(value) })
                  }
                >
                  <SelectTrigger id="priority_level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Highest)</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4 (Lowest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_confidence">Email Confidence</Label>
                <Select
                  value={formData.email_confidence}
                  onValueChange={(value) =>
                    setFormData({ ...formData, email_confidence: value })
                  }
                >
                  <SelectTrigger id="email_confidence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedin_url: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_deal_team"
                  checked={formData.is_deal_team}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_deal_team: !!checked })
                  }
                />
                <Label htmlFor="is_deal_team" className="cursor-pointer">
                  Deal Team Member
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_primary_contact"
                  checked={formData.is_primary_contact}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_primary_contact: !!checked })
                  }
                />
                <Label htmlFor="is_primary_contact" className="cursor-pointer">
                  Primary Contact
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee_agreement_status">Fee Agreement Status</Label>
                <Input
                  id="fee_agreement_status"
                  value={formData.fee_agreement_status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fee_agreement_status: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salesforce_id">Salesforce ID</Label>
                <Input
                  id="salesforce_id"
                  value={formData.salesforce_id}
                  onChange={(e) =>
                    setFormData({ ...formData, salesforce_id: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setEditingContact(null);
                setIsAddDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingContact ? handleUpdateContact : handleAddContact}
            >
              {editingContact ? "Update Contact" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isCSVDialogOpen} onOpenChange={setIsCSVDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple contacts at once
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              CSV import functionality coming soon. Expected columns:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 ml-4 space-y-1">
              <li>• Name (required)</li>
              <li>• Title</li>
              <li>• Email (required)</li>
              <li>• Phone</li>
              <li>• Company Type</li>
              <li>• LinkedIn URL</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCSVDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
