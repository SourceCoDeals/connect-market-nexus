import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealCreated?: () => void;
}

export const AddDealDialog = ({
  open,
  onOpenChange,
  onDealCreated,
}: AddDealDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    website: "",
    location: "",
    revenue: "",
    ebitda: "",
    description: "",
  });

  // Create new deal mutation
  const createDealMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData: {
        title: string;
        website: string | null;
        location: string | null;
        revenue: number | null;
        ebitda: number | null;
        description: string | null;
        is_active: boolean;
        created_by: string | undefined;
        category: string;
        status: string;
      } = {
        title: formData.title,
        website: formData.website || null,
        location: formData.location || null,
        revenue: formData.revenue ? parseFloat(formData.revenue.replace(/[^0-9.]/g, '')) : null,
        ebitda: formData.ebitda ? parseFloat(formData.ebitda.replace(/[^0-9.]/g, '')) : null,
        description: formData.description || null,
        is_active: true,
        created_by: user?.id,
        category: "Other",
        status: "active",
      };

      const { data: listing, error } = await supabase
        .from("listings")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return listing;
    },
    onSuccess: async (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
      toast.success(`Created "${listing.title}" successfully`);
      
      // Trigger AI enrichment if website provided
      if (listing.website) {
        toast.info("Enriching deal with AI...", { id: `enrich-${listing.id}` });
        supabase.functions.invoke("enrich-deal", {
          body: { dealId: listing.id },
        }).then(({ data, error }) => {
          if (error) {
            console.error("Enrichment error:", error);
            toast.error("Enrichment failed", { id: `enrich-${listing.id}` });
          } else if (data?.success) {
            toast.success(`Enriched with ${data.fieldsUpdated?.length || 0} fields`, { id: `enrich-${listing.id}` });
            queryClient.invalidateQueries({ queryKey: ["listings"] });
            queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
          }
        });
      }
      
      // Reset form and close
      setFormData({ title: "", website: "", location: "", revenue: "", ebitda: "", description: "" });
      onDealCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to create deal:", error);
      toast.error("Failed to create deal");
    },
  });

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Deal</DialogTitle>
          <DialogDescription>
            Create a new deal manually. Website is required for AI enrichment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Company Name *</Label>
            <Input
              id="title"
              placeholder="Enter company name"
              value={formData.title}
              onChange={(e) => handleFormChange("title", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website *</Label>
            <Input
              id="website"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => handleFormChange("website", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for AI enrichment to extract company data
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="City, State"
              value={formData.location}
              onChange={(e) => handleFormChange("location", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue</Label>
              <Input
                id="revenue"
                placeholder="$0"
                value={formData.revenue}
                onChange={(e) => handleFormChange("revenue", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ebitda">EBITDA</Label>
              <Input
                id="ebitda"
                placeholder="$0"
                value={formData.ebitda}
                onChange={(e) => handleFormChange("ebitda", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the business..."
              value={formData.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <Button
            onClick={() => createDealMutation.mutate()}
            disabled={!formData.title || !formData.website || createDealMutation.isPending}
            className="w-full"
          >
            {createDealMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Deal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddDealDialog;
