import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { useSourceCoAdmins } from "@/hooks/admin/use-source-co-admins";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";
import { cn } from "@/lib/utils";

interface EditorInternalCardProps {
  form: UseFormReturn<any>;
  dealIdentifier?: string;
}

const BUYER_TYPES = [
  { value: 'privateEquity', label: 'PE' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'familyOffice', label: 'Family Office' },
  { value: 'searchFund', label: 'Search Fund' },
  { value: 'individual', label: 'Individual' },
  { value: 'independentSponsor', label: 'Ind. Sponsor' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'businessOwner', label: 'Bus. Owner' },
] as const;

export function EditorInternalCard({ form, dealIdentifier }: EditorInternalCardProps) {
  const { data: sourceCoAdmins, isLoading: loadingAdmins } = useSourceCoAdmins();
  const visibleToBuyerTypes = form.watch('visible_to_buyer_types') || [];

  const handleBuyerTypeToggle = (value: string) => {
    const current = visibleToBuyerTypes || [];
    const updated = current.includes(value)
      ? current.filter((type: string) => type !== value)
      : [...current, value];
    form.setValue('visible_to_buyer_types', updated);
  };

  return (
    <div className={cn(EDITOR_DESIGN.cardBg, EDITOR_DESIGN.cardBorder, "rounded-lg", EDITOR_DESIGN.cardPadding)}>
      <div className={cn(EDITOR_DESIGN.microHeader, "mb-4")}>
        Internal
      </div>
      
      <div className="space-y-3">
        {/* Deal ID */}
        <div className="flex items-baseline justify-between">
          <span className={EDITOR_DESIGN.microLabel}>Deal</span>
          <code className="text-xs font-mono text-foreground">
            {dealIdentifier || "Auto-generated"}
          </code>
        </div>
        
        {/* Company */}
        <div className={EDITOR_DESIGN.microFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Company</div>
          <FormField
            control={form.control}
            name="internal_company_name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Confidential name"
                    {...field}
                    value={field.value || ''}
                    className={cn(EDITOR_DESIGN.miniHeight, "text-sm", EDITOR_DESIGN.inputBg)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        {/* Owner */}
        <div className={EDITOR_DESIGN.microFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Owner</div>
          <FormField
            control={form.control}
            name="internal_primary_owner"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={cn(EDITOR_DESIGN.miniHeight, "text-sm", EDITOR_DESIGN.inputBg)}>
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
              </FormItem>
            )}
          />
        </div>
        
        {/* Presenter */}
        <div className={EDITOR_DESIGN.microFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Presenter</div>
          <FormField
            control={form.control}
            name="presented_by_admin"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className={cn(EDITOR_DESIGN.miniHeight, "text-sm", EDITOR_DESIGN.inputBg)}>
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
              </FormItem>
            )}
          />
        </div>
        
        {/* CRM Links */}
        <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, "space-y-2")}>
          <Input
            placeholder="Salesforce URL"
            {...form.register('internal_salesforce_link')}
            className={cn(EDITOR_DESIGN.miniHeight, "text-xs font-mono", EDITOR_DESIGN.inputBg)}
          />
          <Input
            placeholder="Company URL"
            {...form.register('internal_deal_memo_link')}
            className={cn(EDITOR_DESIGN.miniHeight, "text-xs font-mono", EDITOR_DESIGN.inputBg)}
          />
        </div>
        
        {/* Investment Context */}
        <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, EDITOR_DESIGN.microFieldSpacing)}>
          <div className={EDITOR_DESIGN.microLabel}>Investment Context</div>
          <Textarea
            rows={3}
            placeholder="Why is this a good deal? Key thesis points..."
            {...form.register('owner_notes')}
            className={cn("text-xs resize-none", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
          />
        </div>
        
        {/* Contact Info */}
        <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, EDITOR_DESIGN.microFieldSpacing)}>
          <div className={EDITOR_DESIGN.microLabel}>Contacts</div>
          <Textarea
            rows={2}
            placeholder="Contact information..."
            {...form.register('internal_contact_info')}
            className={cn("text-xs resize-none", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
          />
        </div>
        
        {/* Internal Notes */}
        <div className={EDITOR_DESIGN.microFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Internal Notes</div>
          <Textarea
            rows={3}
            placeholder="Additional internal context..."
            {...form.register('internal_notes')}
            className={cn("text-xs resize-none", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
          />
        </div>
        
        {/* Status */}
        <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, EDITOR_DESIGN.microFieldSpacing)}>
          <div className={EDITOR_DESIGN.microLabel}>Status</div>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="active" className="h-4 w-4" />
                      <Label className="text-sm font-normal cursor-pointer">Active</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="inactive" className="h-4 w-4" />
                      <Label className="text-sm font-normal cursor-pointer">Inactive</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        {/* Status Tag */}
        <div className={EDITOR_DESIGN.microFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Tag</div>
          <FormField
            control={form.control}
            name="status_tag"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value || 'none'} defaultValue="none">
                  <FormControl>
                    <SelectTrigger className={cn(EDITOR_DESIGN.miniHeight, "text-sm", EDITOR_DESIGN.inputBg)}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No tag</SelectItem>
                    <SelectItem value="Just Listed">Just Listed</SelectItem>
                    <SelectItem value="Price Reduced">Price Reduced</SelectItem>
                    <SelectItem value="Featured">Featured</SelectItem>
                    <SelectItem value="Hot Deal">Hot Deal</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        
        {/* Visibility - Hide From */}
        <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider)}>
          <div className={cn(EDITOR_DESIGN.microLabel, "mb-1")}>Hide From</div>
          <p className="text-[10px] text-muted-foreground/60 mb-2">Visible to all by default. Select buyer types to hide this listing from.</p>
          <div className="flex flex-wrap gap-1.5">
            {BUYER_TYPES.map((type) => (
              <label
                key={type.value}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer transition-colors",
                  visibleToBuyerTypes.includes(type.value)
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-border/40 bg-white/50 hover:border-primary/20"
                )}
              >
                <Checkbox
                  checked={visibleToBuyerTypes.includes(type.value)}
                  onCheckedChange={() => handleBuyerTypeToggle(type.value)}
                  className="h-3 w-3"
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
