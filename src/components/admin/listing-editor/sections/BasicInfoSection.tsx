import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface BasicInfoSectionProps {
  form: UseFormReturn<any>;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Business Overview</h2>
        <p className="text-sm text-muted-foreground">
          Core information that defines the listing and helps buyers discover it
        </p>
      </div>

      <Card className="p-6 space-y-6 border-muted/50">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Business Title *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Established SaaS Platform in Healthcare" 
                  {...field} 
                  className="text-base"
                />
              </FormControl>
              <FormDescription className="text-xs">
                Clear, professional title that captures the business essence
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Categories *</FormLabel>
                <FormControl>
                  <EnhancedMultiCategorySelect
                    value={field.value || []}
                    onValueChange={field.onChange}
                    placeholder="Select industries"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locations"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Geographic Coverage *</FormLabel>
                <FormControl>
                  <EnhancedMultiLocationSelect
                    value={field.value || []}
                    onValueChange={field.onChange}
                    placeholder="Select locations"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Annual Revenue</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., $2.5M" 
                    {...field} 
                    className="text-base"
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Most recent fiscal year revenue
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ebitda"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">EBITDA</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., $500K" 
                    {...field} 
                    className="text-base"
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Earnings before interest, taxes, depreciation, amortization
                </FormDescription>
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
              <FormLabel className="text-sm font-medium">Listing Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </Card>
    </div>
  );
}
