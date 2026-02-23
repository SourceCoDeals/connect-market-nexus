import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddContactDialogProps {
  firmName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newContact: {
    name: string;
    email: string;
    phone: string;
    role: string;
    linkedin_url: string;
    is_primary: boolean;
  };
  setNewContact: (contact: {
    name: string;
    email: string;
    phone: string;
    role: string;
    linkedin_url: string;
    is_primary: boolean;
  }) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export const AddContactDialog = ({
  firmName,
  open,
  onOpenChange,
  newContact,
  setNewContact,
  onSubmit,
  isPending,
}: AddContactDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a contact at {firmName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Name *</Label>
            <Input
              id="contact_name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_role">Role</Label>
            <Input
              id="contact_role"
              placeholder="e.g., Managing Partner, VP Business Development"
              value={newContact.role}
              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_linkedin">LinkedIn URL</Label>
            <Input
              id="contact_linkedin"
              placeholder="https://linkedin.com/in/..."
              value={newContact.linkedin_url}
              onChange={(e) =>
                setNewContact({ ...newContact, linkedin_url: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!newContact.name || isPending}
          >
            Add Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
