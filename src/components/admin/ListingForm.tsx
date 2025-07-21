
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
import { Loader2 } from "lucide-react";
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
  owner_notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

// Form-specific type that matches the Zod schema (before transformation)
type ListingFormInput = {
  title: string;
  categories: string[];
  location: string;
  revenue: string;
  ebitda: string;
  description: string;
  owner_notes?: string;
  status: "active" | "inactive";
};

// Type after Zod transformation
type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ListingFormProps {
  onSubmit: (data: ListingFormValues, image?: File | null) => Promise<void>;
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
    owner_notes: listing?.owner_notes || "",
    status: listing?.status || "active",
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
      const transformedData: ListingFormValues = {
        title: formData.title,
        categories: formData.categories,
        location: formData.location,
        revenue: parseCurrency(formData.revenue),
        ebitda: parseCurrency(formData.ebitda),
        description: formData.description,
        owner_notes: formData.owner_notes,
        status: formData.status,
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

  const categoryOptions = categories.map(category => ({
    value: category.name,
    label: category.name,
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
                  <Input 
                    placeholder="E.g., New York, NY" 
                    className="h-11" 
                    {...field} 
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the business in detail..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
