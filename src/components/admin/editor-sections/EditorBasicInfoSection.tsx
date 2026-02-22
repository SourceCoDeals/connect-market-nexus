import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { Building2, Tag, Target, UserCog } from "lucide-react";
import { EditorBuyerVisibilitySection } from "./EditorBuyerVisibilitySection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AcquisitionTypeBadge from "@/components/listing/AcquisitionTypeBadge";
import ListingStatusTag from "@/components/listing/ListingStatusTag";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import { ADMIN_PROFILES } from "@/lib/admin-profiles";

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
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
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
                  <SelectItem value="none">
                    <span className="text-sm text-muted-foreground">No Tag</span>
                  </SelectItem>
                  <SelectItem value="just_listed">
                    <ListingStatusTag status="just_listed" variant="inline" />
                  </SelectItem>
                  <SelectItem value="in_diligence">
                    <ListingStatusTag status="in_diligence" variant="inline" />
                  </SelectItem>
                  <SelectItem value="under_loi">
                    <ListingStatusTag status="under_loi" variant="inline" />
                  </SelectItem>
                  <SelectItem value="accepted_offer">
                    <ListingStatusTag status="accepted_offer" variant="inline" />
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acquisition_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Acquisition Type (Optional)
              </FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                defaultValue={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger className="h-11 bg-background border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-sm text-muted-foreground">Not specified</span>
                  </SelectItem>
                  <SelectItem value="add_on">
                    <AcquisitionTypeBadge type="add_on" />
                  </SelectItem>
                  <SelectItem value="platform">
                    <AcquisitionTypeBadge type="platform" />
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="presented_by_admin_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Deal Presented By
              </FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                defaultValue={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger className="h-11 bg-background border-border">
                    <SelectValue placeholder="Select advisor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">
                    <span className="text-sm text-muted-foreground">Default (Primary Owner)</span>
                  </SelectItem>
                  {Object.entries(ADMIN_PROFILES).map(([email, profile]) => (
                    <SelectItem key={email} value={email}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{profile.name}</span>
                        <span className="text-xs text-muted-foreground">{profile.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin who will be shown as presenting this deal to buyers
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Buyer Visibility Section */}
      <div className="pt-6 border-t border-border">
        <EditorBuyerVisibilitySection form={form} />
      </div>
    </div>
  );
}
