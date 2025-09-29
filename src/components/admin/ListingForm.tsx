
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminListing } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditorEnhanced } from "@/components/ui/rich-text-editor-enhanced";
import { LocationSelect } from "@/components/ui/location-select";
import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { Loader2 } from "lucide-react";
import { InternalCompanyInfoSection } from "./InternalCompanyInfoSection";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCurrency, formatNumber } from "@/lib/currency-utils";
import { useAdmin } from "@/hooks/use-admin";

// Form schema with categories array instead of single category
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  location: z.string().min(2, "Location is required"),
  revenue: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "Revenue cannot be negative"),
  ebitda: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "EBITDA cannot be negative"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  description_html: z.string().optional(),
  description_json: z.any().optional(),
  owner_notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  status_tag: z.string().nullable().optional(),
  
  // Admin-only internal fields
  internal_company_name: z.string().optional(),
  internal_primary_owner: z.string().optional(),
  internal_salesforce_link: z.string().optional(),
  internal_deal_memo_link: z.string().optional(),
  internal_contact_info: z.string().optional(),
  internal_notes: z.string().optional(),
});

// Form-specific type that matches the Zod schema (before transformation)
type ListingFormInput = {
  title: string;
  categories: string[];
  location: string;
  revenue: string;
  ebitda: string;
  description: string;
  description_html?: string;
  description_json?: any;
  owner_notes?: string;
  status: "active" | "inactive";
  status_tag?: string;
  
  // Admin-only internal fields
  internal_company_name?: string;
  internal_primary_owner?: string;
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
};

// Type after Zod transformation
type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ListingFormProps {
  onSubmit: (data: ListingFormValues & { description_html?: string; description_json?: any }, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
}

// Helper function to convert AdminListing to form input format
const convertListingToFormInput = (listing?: AdminListing): ListingFormInput => {
  return {
    title: listing?.title || "",
    categories: listing?.categories || (listing?.category ? [listing.category] : []),
    location: listing?.location || "",
    revenue: listing?.revenue ? formatNumber(Number(listing.revenue)) : "",
    ebitda: listing?.ebitda ? formatNumber(Number(listing.ebitda)) : "",
    description: listing?.description || "",
    description_html: listing?.description_html || "",
    description_json: listing?.description_json || null,
    owner_notes: listing?.owner_notes || "",
    status: listing?.status || "active",
    status_tag: listing?.status_tag ?? null,
    
    // Admin-only internal fields
    internal_company_name: listing?.internal_company_name || "",
    internal_primary_owner: listing?.internal_primary_owner || "",
    internal_salesforce_link: listing?.internal_salesforce_link || "",
    internal_deal_memo_link: listing?.internal_deal_memo_link || "",
    internal_contact_info: listing?.internal_contact_info || "",
    internal_notes: listing?.internal_notes || "",
  };
};

export function ListingForm({
  onSubmit,
  listing,
  isLoading = false,
}: ListingFormProps) {
  const { useCategories } = useAdmin();
  const { data: categories = [] } = useCategories();
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    listing?.image_url || null
  );
  const [isImageChanged, setIsImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<ListingFormInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: convertListingToFormInput(listing),
  });

  const handleImageSelect = (file: File | null) => {
    if (file) {
      // Validate file
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Image file size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setImageError("Please select a valid image file (JPEG, PNG, WebP, GIF)");
        return;
      }
      
      setImageError(null);
      setSelectedImage(file);
      setIsImageChanged(true);
      
      // Create image preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIsImageChanged(true);
    setImageError(null);
  };

  const handleSubmit = async (formData: ListingFormInput) => {
    try {
      if (imageError) {
        toast({
          variant: "destructive",
          title: "Image Error",
          description: imageError,
        });
        return;
      }
      
      // Transform the form data to match ListingFormValues type
      const transformedData: ListingFormValues & { description_html?: string; description_json?: any } = {
        title: formData.title,
        categories: formData.categories,
        location: formData.location,
        revenue: parseCurrency(formData.revenue),
        ebitda: parseCurrency(formData.ebitda),
        description: formData.description,
        description_html: formData.description_html,
        description_json: formData.description_json,
        owner_notes: formData.owner_notes,
        status: formData.status,
        status_tag: formData.status_tag && formData.status_tag !== "none" ? formData.status_tag : null,
        
        // Admin-only internal fields
        internal_company_name: formData.internal_company_name,
        internal_primary_owner: formData.internal_primary_owner,
        internal_salesforce_link: formData.internal_salesforce_link,
        internal_deal_memo_link: formData.internal_deal_memo_link,
        internal_contact_info: formData.internal_contact_info,
        internal_notes: formData.internal_notes,
      };
      
      // Only pass the image if it's been changed
      await onSubmit(transformedData, isImageChanged ? selectedImage : undefined);
      
      if (!listing) {
        // Reset form after successful submission for new listings
        form.reset();
        setSelectedImage(null);
        setImagePreview(null);
        setIsImageChanged(false);
      }
    } catch (error: any) {
      console.error("Error submitting listing:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save listing",
      });
    }
  };

  // Use standardized categories for consistency
  const categoryOptions = STANDARDIZED_CATEGORIES.map(category => ({
    value: category,
    label: category,
  }));

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4 sm:space-y-5"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Business Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="E.g., Profitable SaaS Business" 
                  className="h-11" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Categories (Select up to 2)</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={categoryOptions}
                    selected={field.value}
                    onSelectedChange={field.onChange}
                    placeholder="Select categories..."
                    maxSelected={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Location</FormLabel>
                <FormControl>
                  <LocationSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select location..."
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Annual Revenue</FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual revenue"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ebitda"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Annual EBITDA</FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual EBITDA"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status_tag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status Tag</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                defaultValue={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="No tag selected" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Tag</SelectItem>
                  <SelectItem value="just_listed">Just Listed</SelectItem>
                  <SelectItem value="in_diligence">In Diligence</SelectItem>
                  <SelectItem value="under_loi">Under LOI</SelectItem>
                  <SelectItem value="accepted_offer">Accepted Offer</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormLabel className="text-base font-semibold">Business Description</FormLabel>
          
          <FormField
            control={form.control}
            name="description_html"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RichTextEditorEnhanced
                    content={field.value || form.getValues('description') || ''}
                    onChange={(html, json) => {
                      field.onChange(html);
                      form.setValue('description_json', json);
                      // Keep plain text description for backwards compatibility
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = html;
                      const plainText = tempDiv.textContent || tempDiv.innerText || '';
                      form.setValue('description', plainText);
                    }}
                    placeholder="Create a compelling business description using our professional tools..."
                    className="min-h-[500px]"
                    characterLimit={20000}
                    autoSave={true}
                    showWordCount={true}
                    showPreview={true}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="owner_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes (Internal)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional notes visible only to admins..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel>Listing Image</FormLabel>
          <ImageUpload
            onImageSelect={handleImageSelect}
            currentImageUrl={imagePreview}
            onRemoveImage={handleRemoveImage}
            error={imageError}
          />
        </div>

        {/* Admin-only Internal Company Information */}
        <InternalCompanyInfoSection 
          control={form.control} 
          dealIdentifier={listing?.deal_identifier}
        />

        <div className="flex flex-col sm:flex-row sm:justify-end pt-6">
          <Button 
            type="submit" 
            disabled={isLoading || !!imageError}
            className="w-full sm:w-auto h-11 touch-manipulation"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing ? "Update Listing" : "Create Listing"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
