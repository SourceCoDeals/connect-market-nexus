import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChipInput } from "@/components/ui/chip-input";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { FIELD_HELPERS } from "@/lib/field-helpers";
import { REVENUE_RANGES, DEAL_SIZE_RANGES } from "@/lib/currency-ranges";
import { DEAL_INTENT_OPTIONS } from "@/lib/signup-field-options";
import type { SignupFormData } from "./types";

interface Props {
  formData: SignupFormData;
  setFormData: React.Dispatch<React.SetStateAction<SignupFormData>>;
}

export function SignupStepBuyerProfile({ formData, setFormData }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="idealTargetDescription" className="text-xs text-muted-foreground">{FIELD_HELPERS.idealTargetDescription.label}</Label>
        <Textarea id="idealTargetDescription" name="idealTargetDescription" placeholder={FIELD_HELPERS.idealTargetDescription.placeholder} rows={3} value={formData.idealTargetDescription} onChange={(e) => setFormData(p => ({ ...p, idealTargetDescription: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.businessCategories.label}</Label>
        <EnhancedMultiCategorySelect value={formData.businessCategories} onValueChange={(selected) => setFormData(p => ({ ...p, businessCategories: selected }))} placeholder={FIELD_HELPERS.businessCategories.placeholder} className="w-full" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetLocations" className="text-xs text-muted-foreground">{FIELD_HELPERS.targetLocations.label}</Label>
        <EnhancedMultiLocationSelect value={Array.isArray(formData.targetLocations) ? formData.targetLocations : []} onValueChange={(selected) => setFormData(p => ({ ...p, targetLocations: selected }))} placeholder={FIELD_HELPERS.targetLocations.placeholder} className="w-full" />
      </div>

      {formData.buyerType === "independentSponsor" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.targetDealSize.label}</Label>
          <Select
            value={formData.targetDealSizeMin && formData.targetDealSizeMax ? `${formData.targetDealSizeMin}-${formData.targetDealSizeMax}` : ""}
            onValueChange={(value) => {
              const range = DEAL_SIZE_RANGES.find(r => r.value === value);
              if (range) {
                const parts = range.value.split(' - ');
                const min = parts[0]?.replace(/[^0-9]/g, '') || "";
                const max = parts[1]?.replace(/[^0-9]/g, '') || "";
                setFormData(p => ({ ...p, targetDealSizeMin: min ? `${min}000000` : "", targetDealSizeMax: max ? `${max}000000` : "" }));
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{DEAL_SIZE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {formData.buyerType !== "privateEquity" && formData.buyerType !== "independentSponsor" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.revenueRange.label}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select value={formData.revenueRangeMin} onValueChange={(v) => setFormData(p => ({ ...p, revenueRangeMin: v }))}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{REVENUE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.revenueRangeMax} onValueChange={(v) => setFormData(p => ({ ...p, revenueRangeMax: v }))}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{REVENUE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="specificBusinessSearch" className="text-xs text-muted-foreground">{FIELD_HELPERS.specificBusinessSearch.label}</Label>
        <Textarea id="specificBusinessSearch" name="specificBusinessSearch" placeholder={FIELD_HELPERS.specificBusinessSearch.placeholder} rows={3} value={formData.specificBusinessSearch} onChange={(e) => setFormData(p => ({ ...p, specificBusinessSearch: e.target.value }))} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.dealIntent.label}</Label>
        <RadioGroup value={formData.dealIntent || ""} onValueChange={(v) => setFormData(p => ({ ...p, dealIntent: v }))} className="space-y-1.5">
          {DEAL_INTENT_OPTIONS.map(o => (
            <div key={o.value} className="flex items-center space-x-2">
              <RadioGroupItem value={o.value} id={o.value} />
              <Label htmlFor={o.value} className="font-normal cursor-pointer text-xs">{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.exclusions.label}</Label>
        <ChipInput value={formData.exclusions || []} onChange={(v) => setFormData(p => ({ ...p, exclusions: v }))} placeholder={FIELD_HELPERS.exclusions.placeholder} maxChips={20} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.includeKeywords.label}</Label>
        <ChipInput value={formData.includeKeywords || []} onChange={(v) => setFormData(p => ({ ...p, includeKeywords: v }))} placeholder={FIELD_HELPERS.includeKeywords.placeholder} maxChips={5} />
      </div>
    </div>
  );
}
