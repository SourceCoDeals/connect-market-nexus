import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clipboard } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { processUrl } from "@/lib/url-utils";
import { useSourceCoAdmins } from "@/hooks/admin/use-source-co-admins";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import ListingStatusTag from "@/components/listing/ListingStatusTag";

interface EditorInternalDataSectionProps {
  form: UseFormReturn<any>;
  dealIdentifier?: string;
}

export function EditorInternalDataSection({ form, dealIdentifier }: EditorInternalDataSectionProps) {
  const { data: sourceCoAdmins, isLoading: loadingAdmins } = useSourceCoAdmins();
  const statusTag = form.watch('status_tag');

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Internal Admin Data</h3>
        <p className="text-xs text-muted-foreground">Confidential information for deal tracking</p>
      </div>

      {/* Deal ID */}
      <div className="bg-slate-50/30 p-3 rounded-lg border">
        <div className="flex items-center gap-2 mb-1">
          <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal ID</span>
        </div>
        <code className="text-sm font-mono text-foreground block">
          {dealIdentifier || "Auto-generated upon creation"}
        </code>
      </div>

      {/* Real Company Name */}
      <FormField
        control={form.control}
        name="internal_company_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Real Company Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Confidential company name"
                {...field}
                value={field.value || ''}
                className="h-10"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Primary Owner */}
      <FormField
        control={form.control}
        name="internal_primary_owner"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Primary Owner</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {loadingAdmins ? (
                  <SelectItem value="_loading" disabled>Loading...</SelectItem>
                ) : sourceCoAdmins && sourceCoAdmins.length > 0 ? (
                  sourceCoAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>No admins found</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Presented By */}
      <FormField
        control={form.control}
        name="presented_by_admin"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Presented By</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select presenter" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {loadingAdmins ? (
                  <SelectItem value="_loading" disabled>Loading...</SelectItem>
                ) : sourceCoAdmins && sourceCoAdmins.length > 0 ? (
                  sourceCoAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>No admins found</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Divider */}
      <div className="border-t pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">CRM Links</p>
      </div>

      {/* Salesforce Link */}
      <FormField
        control={form.control}
        name="internal_salesforce_link"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Salesforce</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://salesforce.com/deal/..."
                {...field}
                value={field.value || ''}
                onChange={(e) => field.onChange(processUrl(e.target.value))}
                className="h-10"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Deal Memo Link */}
      <FormField
        control={form.control}
        name="internal_deal_memo_link"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Deal Memo</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://docs.google.com/..."
                {...field}
                value={field.value || ''}
                onChange={(e) => field.onChange(processUrl(e.target.value))}
                className="h-10"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Contact Info */}
      <FormField
        control={form.control}
        name="internal_contact_info"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Contact Info</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Internal contact details..."
                className="min-h-[60px] text-sm"
                {...field}
                value={field.value || ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Internal Notes */}
      <FormField
        control={form.control}
        name="internal_notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Internal Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Additional internal context..."
                className="min-h-[80px] text-sm"
                {...field}
                value={field.value || ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Divider */}
      <div className="border-t pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Status & Visibility</p>
      </div>

      {/* Status */}
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Status</FormLabel>
            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="active" id="status-active" className="h-4 w-4" />
                <Label htmlFor="status-active" className="text-sm font-normal cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inactive" id="status-inactive" className="h-4 w-4" />
                <Label htmlFor="status-inactive" className="text-sm font-normal cursor-pointer">
                  Inactive
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {field.value === 'active' ? 'Visible to approved buyers' : 'Hidden from marketplace'}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Status Tag */}
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
                <SelectTrigger className="h-10">
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              Optional badge displayed on listing card
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Buyer Type Visibility */}
      <FormField
        control={form.control}
        name="buyer_type_visibility"
        render={() => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Visible to buyer types</FormLabel>
            <div className="space-y-2">
              {['Private Equity', 'Corporate Strategic', 'Family Office', 'Search Fund', 'Independent Sponsor', 'Individual Buyer'].map((buyerType) => (
                <FormField
                  key={buyerType}
                  control={form.control}
                  name="buyer_type_visibility"
                  render={({ field }) => {
                    const currentValue = field.value || [];
                    return (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={currentValue.includes(buyerType)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...currentValue, buyerType]
                                : currentValue.filter((v: string) => v !== buyerType);
                              field.onChange(newValue);
                            }}
                            className="h-4 w-4"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          {buyerType}
                        </FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select which buyer types can see this listing
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
