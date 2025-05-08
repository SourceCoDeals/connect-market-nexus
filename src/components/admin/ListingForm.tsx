import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminListing } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";
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

// Form schema
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  category: z.string().min(1, "Please select a category"),
  location: z.string().min(2, "Location is required"),
  revenue: z.coerce
    .number()
    .min(0, "Revenue cannot be negative")
    .or(z.string().transform((val) => Number(val.replace(/,/g, "")))),
  ebitda: z.coerce
    .number()
    .min(0, "EBITDA cannot be negative")
    .or(z.string().transform((val) => Number(val.replace(/,/g, "")))),
  description: z.string().min(20, "Description must be at least 20 characters"),
  owner_notes: z.string().optional(),
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

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      title: listing?.title || "",
      category: listing?.category || "",
      location: listing?.location || "",
      revenue: listing?.revenue || 0,
      ebitda: listing?.ebitda || 0,
      description: listing?.description || "",
      owner_notes: listing?.owner_notes || "",
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Image too large",
          description: "Please select an image smaller than 5MB",
        });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (values: ListingFormValues) => {
    try {
      await onSubmit(values, selectedImage);
      if (!listing) {
        // Reset form after successful submission for new listings
        form.reset();
        setSelectedImage(null);
        setImagePreview(null);
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
        className="space-y-6"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Annual Revenue ($)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="0"
                    {...field}
                    onChange={(e) => {
                      // Allow only numbers and commas
                      const value = e.target.value.replace(/[^0-9,]/g, "");
                      field.onChange(value);
                    }}
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
                <FormLabel>Annual EBITDA ($)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="0"
                    {...field}
                    onChange={(e) => {
                      // Allow only numbers and commas
                      const value = e.target.value.replace(/[^0-9,]/g, "");
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the business in detail..."
                  className="min-h-[150px]"
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
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Listing Image</FormLabel>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("listing-image")?.click()}
              className="flex items-center gap-2"
            >
              <Upload size={16} />
              {selectedImage ? "Change Image" : "Upload Image"}
            </Button>
            <Input
              id="listing-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <span className="text-sm text-muted-foreground">
              {selectedImage ? selectedImage.name : "No image selected"}
            </span>
          </div>
          {imagePreview && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Preview:</div>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-w-xs h-auto object-cover rounded-md border"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing ? "Update Listing" : "Create Listing"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
