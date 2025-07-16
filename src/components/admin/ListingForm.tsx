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
import { Loader2, Upload, Image as ImageIcon, AlertCircle } from "lucide-react";
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
import { DEFAULT_IMAGE } from "@/lib/storage-utils";
import { parseCurrency, formatNumber } from "@/lib/currency-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Type for listing categories
const categories = [
  "Technology",
  "E-commerce",
  "SaaS",
  "Manufacturing",
  "Retail",
  "Healthcare",
  "Food & Beverage",
  "Service",
  "Other",
] as const;

// Form schema with improved currency validation
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  category: z.string().min(1, "Please select a category"),
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

type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ListingFormProps {
  onSubmit: (data: ListingFormValues, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
}

export function ListingForm({
  onSubmit,
  listing,
  isLoading = false,
}: ListingFormProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    listing?.image_url || null
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isImageChanged, setIsImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      title: listing?.title || "",
      category: listing?.category || "",
      location: listing?.location || "",
      revenue: listing?.revenue ? String(listing.revenue) : "",
      ebitda: listing?.ebitda ? String(listing.ebitda) : "",
      description: listing?.description || "",
      owner_notes: listing?.owner_notes || "",
      status: listing?.status || "active",
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Image file size must be less than 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setImageError("Please select a valid image file (JPEG, PNG, WebP, GIF)");
        return;
      }

      setSelectedImage(file);
      setIsImageChanged(true);
      
      // Create image preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Simulate upload progress (just for UX feedback)
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 50);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIsImageChanged(true);
    setImageError(null);
  };

  const handleSubmit = async (values: ListingFormValues) => {
    try {
      if (imageError) {
        toast({
          variant: "destructive",
          title: "Image Error",
          description: imageError,
        });
        return;
      }
      
      // Only pass the image if it's been changed
      await onSubmit(values, isImageChanged ? selectedImage : undefined);
      
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Title</FormLabel>
              <FormControl>
                <Input placeholder="E.g., Profitable SaaS Business" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="E.g., New York, NY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Annual Revenue</FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual revenue"
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
                <FormLabel>Annual EBITDA</FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual EBITDA"
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
          
          {imageError && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{imageError}</AlertDescription>
            </Alert>
          )}
          
          {imagePreview ? (
            <div className="rounded-md border overflow-hidden">
              <div className="relative max-w-md mx-auto">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-auto object-cover rounded-md max-h-[200px]" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = DEFAULT_IMAGE;
                    setImageError("Failed to load image preview");
                  }}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className="border-2 border-dashed border-muted-foreground/20 rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 transition"
              onClick={() => document.getElementById("listing-image")?.click()}
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Click to upload an image, or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG or WebP (max 5MB)</p>
            </div>
          )}
          
          <Input
            id="listing-image"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isLoading || !!imageError}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing ? "Update Listing" : "Create Listing"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
