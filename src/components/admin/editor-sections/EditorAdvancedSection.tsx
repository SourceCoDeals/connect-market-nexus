import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings } from "lucide-react";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { EditorBuyerVisibilitySection } from "./EditorBuyerVisibilitySection";

interface EditorAdvancedSectionProps {
  form: UseFormReturn<any>;
}

export function EditorAdvancedSection({ form }: EditorAdvancedSectionProps) {
  const status = form.watch('status');
  const statusTag = form.watch('status_tag');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Advanced Settings</h3>
          <p className="text-sm text-muted-foreground">Status, tags, and buyer visibility controls</p>
        </div>
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
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {status === 'active' ? 'Visible to approved buyers in marketplace' : 'Hidden from marketplace, only visible to admins'}
              </p>
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
                Status Tag
                {statusTag && statusTag !== 'none' && (
                  <ListingStatusTag status={statusTag} />
                )}
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value || 'none'}>
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select tag (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="exclusive">Exclusive</SelectItem>
                  <SelectItem value="reduced">Reduced</SelectItem>
                  <SelectItem value="closing_soon">Closing Soon</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional badge displayed on the listing card
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <EditorBuyerVisibilitySection form={form} />
    </div>
  );
}
