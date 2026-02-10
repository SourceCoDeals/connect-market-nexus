import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PartnerFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  is_active: boolean;
}

interface AddPartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPartner?: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    is_active: boolean | null;
  } | null;
}

const defaultForm: PartnerFormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  notes: "",
  is_active: true,
};

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function AddPartnerDialog({
  open,
  onOpenChange,
  editingPartner,
}: AddPartnerDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PartnerFormData>(defaultForm);
  const isEditing = !!editingPartner;

  useEffect(() => {
    if (editingPartner) {
      setForm({
        name: editingPartner.name,
        company: editingPartner.company || "",
        email: editingPartner.email || "",
        phone: editingPartner.phone || "",
        notes: editingPartner.notes || "",
        is_active: editingPartner.is_active ?? true,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editingPartner, open]);

  const createMutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      const password = generatePassword();

      // Hash password via edge function
      const { data: hashResult, error: hashError } = await supabase.functions.invoke(
        "validate-referral-access",
        { body: { action: "hash-password", password } }
      );

      const insertData: Record<string, unknown> = {
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        is_active: data.is_active,
      };

      // If hashing works, store the hash; otherwise store plaintext temporarily
      if (hashResult?.hash) {
        insertData.share_password_hash = hashResult.hash;
      } else {
        // Fallback: store password as hash field (will be hashed on first validate)
        insertData.share_password_hash = password;
      }

      const { data: partner, error } = await supabase
        .from("referral_partners")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return { partner, password };
    },
    onSuccess: ({ partner, password }) => {
      queryClient.invalidateQueries({ queryKey: ["referral-partners"] });
      toast.success(`Partner "${partner.name}" created`, {
        description: `Share password: ${password}`,
        duration: 15000,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to create partner: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      if (!editingPartner) throw new Error("No partner to edit");

      const { data: partner, error } = await supabase
        .from("referral_partners")
        .update({
          name: data.name,
          company: data.company || null,
          email: data.email || null,
          phone: data.phone || null,
          notes: data.notes || null,
          is_active: data.is_active,
        } as never)
        .eq("id", editingPartner.id)
        .select()
        .single();

      if (error) throw error;
      return partner;
    },
    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: ["referral-partners"] });
      toast.success(`Partner "${partner.name}" updated`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to update partner: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Partner name is required");
      return;
    }
    if (isEditing) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Partner" : "Add Referral Partner"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update referral partner details"
              : "Add a new referral partner. A share link and password will be auto-generated."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="partner-name">Partner Name *</Label>
            <Input
              id="partner-name"
              placeholder="Individual person name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-company">Firm / Company</Label>
            <Input
              id="partner-company"
              placeholder="May be an individual with no firm"
              value={form.company}
              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="partner-email">Email</Label>
              <Input
                id="partner-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-phone">Phone</Label>
              <Input
                id="partner-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-notes">Notes</Label>
            <Textarea
              id="partner-notes"
              placeholder="Internal notes about this partner"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="partner-active">Active</Label>
            <Switch
              id="partner-active"
              checked={form.is_active}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, is_active: checked }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Partner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
