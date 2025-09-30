import { Control } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { LocationSelect } from "@/components/ui/location-select";
import { ImageUpload } from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { Building2, MapPin, DollarSign, Tags } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";

interface BasicInfoStepProps {
  control: Control<any>;
  selectedImage: File | null;
  imagePreview: string | null;
  imageError: string | null;
  onImageSelect: (file: File | null) => void;
  onRemoveImage: () => void;
}

export function BasicInfoStep({
  control,
  selectedImage,
  imagePreview,
  imageError,
  onImageSelect,
  onRemoveImage,
}: BasicInfoStepProps) {
  const { useCategories } = useAdmin();
  const { data: categories = [] } = useCategories();

  const categoryOptions = STANDARDIZED_CATEGORIES.map(category => ({
    value: category,
    label: category,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Basic Information</h2>
        <p className="text-muted-foreground">
          Start with the essential details about the business
        </p>
      </div>

      <div className="space-y-5">
        <FormField
          control={control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Title
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Profitable SaaS Business in the HR Tech Space" 
                  className="h-11" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Create a compelling, descriptive title that captures buyer attention
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FormField
            control={control}
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  Business Categories
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    options={categoryOptions}
                    selected={field.value}
                    onSelectedChange={field.onChange}
                    placeholder="Select up to 2 categories..."
                    maxSelected={2}
                  />
                </FormControl>
                <FormDescription>
                  Choose the most relevant industry categories
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </FormLabel>
                <FormControl>
                  <LocationSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select business location..."
                    className="h-11"
                  />
                </FormControl>
                <FormDescription>
                  Primary business location
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FormField
            control={control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Annual Revenue
                </FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual revenue"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Total annual revenue in USD
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="ebitda"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Annual EBITDA
                </FormLabel>
                <FormControl>
                  <CurrencyInput
                    placeholder="Enter annual EBITDA"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Earnings before interest, taxes, depreciation, and amortization
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Listing Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Controls visibility on the marketplace
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="status_tag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status Tag (Optional)</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                  defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
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
                <FormDescription>
                  Add a badge to highlight listing status
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 pt-4 border-t">
          <FormLabel>Listing Image</FormLabel>
          <FormDescription>
            Upload a professional image that represents the business (max 5MB)
          </FormDescription>
          <ImageUpload
            onImageSelect={onImageSelect}
            currentImageUrl={imagePreview}
            onRemoveImage={onRemoveImage}
            error={imageError}
          />
        </div>
      </div>
    </div>
  );
}
