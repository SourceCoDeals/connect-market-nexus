import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AcquisitionTypeBadge from "@/components/listing/AcquisitionTypeBadge";

interface EditorCoreDetailsSectionProps {
  form: UseFormReturn<any>;
}

export function EditorCoreDetailsSection({ form }: EditorCoreDetailsSectionProps) {
  const acquisitionType = form.watch('acquisition_type');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Core Listing Details</h3>
          <p className="text-sm text-muted-foreground">Title, industry, location, and acquisition type</p>
        </div>
      </div>

      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Business Title</FormLabel>
            <FormControl>
              <Input 
                placeholder="E.g., Profitable SaaS Platform with Recurring Revenue" 
                className="h-11" 
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Industries</FormLabel>
              <FormControl>
                <EnhancedMultiCategorySelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select up to 2 industries..."
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
              <FormLabel className="text-sm font-medium">Geographic Focus</FormLabel>
              <FormControl>
                <EnhancedMultiLocationSelect
                  value={field.value ? [field.value] : []}
                  onValueChange={(values) => field.onChange(values[0] || "")}
                  placeholder="Select primary location..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="acquisition_type"
        render={({ field }) => (
          <FormItem>
          <FormLabel className="text-sm font-medium flex items-center gap-2">
              Acquisition Type
              {acquisitionType && acquisitionType !== 'none' && (
                <AcquisitionTypeBadge type={acquisitionType} />
              )}
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value || 'none'}>
              <FormControl>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="platform">Platform</SelectItem>
                <SelectItem value="add_on">Add-on</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Platform: Foundational business for growth via acquisitions. Add-on: Complementary acquisition for existing platform.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
