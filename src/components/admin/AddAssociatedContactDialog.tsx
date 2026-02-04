import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAssociatedContact, CreateAssociatedContactData } from "@/hooks/admin/use-associated-contacts";
import { Loader2 } from "lucide-react";

interface AddAssociatedContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionRequestId: string;
  companyName: string;
}

export const AddAssociatedContactDialog = ({
  open,
  onOpenChange,
  connectionRequestId,
  companyName,
}: AddAssociatedContactDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });

  const createContact = useCreateAssociatedContact();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const contactData: CreateAssociatedContactData = {
      connection_request_id: connectionRequestId,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      role: formData.role || undefined,
      company: companyName,
      source: 'manual',
    };

    createContact.mutate(contactData, {
      onSuccess: () => {
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          role: "",
        });
        // Close dialog
        onOpenChange(false);
      },
    });
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Associated Contact</DialogTitle>
          <DialogDescription>
            Add another contact from {companyName} who is interested in this listing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleChange("name")}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange("email")}
                placeholder="john@company.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange("phone")}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role/Title</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={handleChange("role")}
                placeholder="VP of Corporate Development"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={companyName}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createContact.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
