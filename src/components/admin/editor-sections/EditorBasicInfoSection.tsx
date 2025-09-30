import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { Building2, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface EditorBasicInfoSectionProps {
  form: UseFormReturn<any>;
}

export function EditorBasicInfoSection({ form }: EditorBasicInfoSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-sourceco-muted">
          <Building2 className="h-5 w-5 text-sourceco-accent" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Business Overview</h3>
          <p className="text-sm text-muted-foreground">Essential information about the business</p>
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
                className="h-11 bg-background border-border focus:border-sourceco-accent transition-colors" 
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Listing Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11 bg-background border-border">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                      <span className="text-sm text-muted-foreground">Visible to buyers</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      <span className="text-sm text-muted-foreground">Hidden from marketplace</span>
                    </div>
                  </SelectItem>
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
              <FormLabel className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Status Tag (Optional)
              </FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                defaultValue={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger className="h-11 bg-background border-border">
                    <SelectValue placeholder="No tag" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Tag</SelectItem>
                  <SelectItem value="just_listed">
                    <Badge className="bg-sourceco-accent text-sourceco-accent-foreground">Just Listed</Badge>
                  </SelectItem>
                  <SelectItem value="in_diligence">
                    <Badge className="bg-info text-info-foreground">In Diligence</Badge>
                  </SelectItem>
                  <SelectItem value="under_loi">
                    <Badge className="bg-warning text-warning-foreground">Under LOI</Badge>
                  </SelectItem>
                  <SelectItem value="accepted_offer">
                    <Badge className="bg-success text-success-foreground">Accepted Offer</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
