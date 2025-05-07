
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminListing } from "@/types/admin";
import { DialogFooter } from "@/components/ui/dialog";

interface ListingFormProps {
  listing?: AdminListing | null;
  onSuccess: () => void;
}

const ListingForm = ({ listing, onSuccess }: ListingFormProps) => {
  const { useCreateListing, useUpdateListing } = useAdmin();
  const { mutate: createListing, isPending: isCreating } = useCreateListing();
  const { mutate: updateListing, isPending: isUpdating } = useUpdateListing();
  
  const [formData, setFormData] = useState<Partial<AdminListing>>(
    listing || {
      title: "",
      category: "",
      location: "",
      revenue: 0,
      ebitda: 0,
      description: "",
      tags: [],
      owner_notes: "",
    }
  );
  
  const [tagsInput, setTagsInput] = useState(listing?.tags?.join(", ") || "");
  
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === "revenue" || name === "ebitda") {
      setFormData({
        ...formData,
        [name]: parseFloat(value) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };
  
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
    // Convert comma-separated tags to array
    const tagsArray = e.target.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    
    setFormData({
      ...formData,
      tags: tagsArray,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (listing) {
      updateListing(
        {
          id: listing.id,
          listing: formData,
        },
        {
          onSuccess,
        }
      );
    } else {
      createListing(formData as Omit<AdminListing, "id" | "created_at" | "updated_at">, {
        onSuccess,
      });
    }
  };
  
  const isLoading = isCreating || isUpdating;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Listing Title *</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="E.g., Profitable SaaS Business in Marketing Space"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Input
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="E.g., Technology, Manufacturing, Retail"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="E.g., California, New York, Texas"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            name="tags"
            value={tagsInput}
            onChange={handleTagsChange}
            placeholder="E.g., SaaS, B2B, Recurring Revenue"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="revenue">Annual Revenue ($) *</Label>
          <Input
            id="revenue"
            name="revenue"
            type="number"
            min="0"
            step="10000"
            value={formData.revenue}
            onChange={handleChange}
            placeholder="Annual revenue in USD"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="ebitda">Annual EBITDA ($) *</Label>
          <Input
            id="ebitda"
            name="ebitda"
            type="number"
            min="0"
            step="10000"
            value={formData.ebitda}
            onChange={handleChange}
            placeholder="Annual EBITDA in USD"
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Business Description *</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Provide a detailed description of the business..."
          rows={5}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="owner_notes">Owner Notes</Label>
        <Textarea
          id="owner_notes"
          name="owner_notes"
          value={formData.owner_notes}
          onChange={handleChange}
          placeholder="Additional notes from the business owner..."
          rows={3}
        />
      </div>
      
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? listing
              ? "Updating..."
              : "Creating..."
            : listing
              ? "Update Listing"
              : "Create Listing"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default ListingForm;
