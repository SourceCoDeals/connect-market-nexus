import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChipInput } from '@/components/ui/chip-input';
import { EnhancedMultiCategorySelect } from '@/components/ui/enhanced-category-select';
import { EnhancedMultiLocationSelect } from '@/components/ui/enhanced-location-select';
import { FIELD_HELPERS } from '@/lib/field-helpers';
import { REVENUE_RANGES, DEAL_SIZE_RANGES } from '@/lib/currency-ranges';
import { DEAL_INTENT_OPTIONS } from '@/lib/signup-field-options';
import type { BuyerProfileStepProps } from './types';

export const BuyerProfileStep = ({ formData, setFormData }: BuyerProfileStepProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="idealTargetDescription" className="text-xs text-muted-foreground">
          {FIELD_HELPERS.idealTargetDescription.label}
        </Label>
        <Textarea
          id="idealTargetDescription"
          name="idealTargetDescription"
          placeholder={FIELD_HELPERS.idealTargetDescription.placeholder}
          rows={3}
          value={formData.idealTargetDescription}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, idealTargetDescription: e.target.value }))
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {FIELD_HELPERS.businessCategories.label}
        </Label>
        <EnhancedMultiCategorySelect
          value={formData.businessCategories}
          onValueChange={(selected) =>
            setFormData((prev) => ({ ...prev, businessCategories: selected }))
          }
          placeholder={FIELD_HELPERS.businessCategories.placeholder}
          className="w-full"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetLocations" className="text-xs text-muted-foreground">
          {FIELD_HELPERS.targetLocations.label}
        </Label>
        <EnhancedMultiLocationSelect
          value={Array.isArray(formData.targetLocations) ? formData.targetLocations : []}
          onValueChange={(selected) =>
            setFormData((prev) => ({ ...prev, targetLocations: selected }))
          }
          placeholder={FIELD_HELPERS.targetLocations.placeholder}
          className="w-full"
        />
      </div>

      {/* Independent sponsor deal size ranges */}
      {formData.buyerType === 'independentSponsor' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {FIELD_HELPERS.targetDealSize.label}
          </Label>
          <Select
            value={
              formData.targetDealSizeMin && formData.targetDealSizeMax
                ? `${formData.targetDealSizeMin}-${formData.targetDealSizeMax}`
                : ''
            }
            onValueChange={(value) => {
              const range = DEAL_SIZE_RANGES.find((r) => r.value === value);
              if (range) {
                const parts = range.value.split(' - ');
                const min = parts[0]?.replace(/[^0-9]/g, '') || '';
                const max = parts[1]?.replace(/[^0-9]/g, '') || '';
                setFormData((prev) => ({
                  ...prev,
                  targetDealSizeMin: min ? `${min}000000` : '',
                  targetDealSizeMax: max ? `${max}000000` : '',
                }));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {DEAL_SIZE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Only show revenue range if buyer type is not Private Equity or Independent Sponsor */}
      {formData.buyerType !== 'privateEquity' && formData.buyerType !== 'independentSponsor' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {FIELD_HELPERS.revenueRange.label}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={formData.revenueRangeMin}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, revenueRangeMin: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={formData.revenueRangeMax}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, revenueRangeMax: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="specificBusinessSearch" className="text-xs text-muted-foreground">
          {FIELD_HELPERS.specificBusinessSearch.label}
        </Label>
        <Textarea
          id="specificBusinessSearch"
          name="specificBusinessSearch"
          placeholder={FIELD_HELPERS.specificBusinessSearch.placeholder}
          rows={3}
          value={formData.specificBusinessSearch}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, specificBusinessSearch: e.target.value }))
          }
        />
      </div>

      {/* Deal Intent */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.dealIntent.label}</Label>
        <RadioGroup
          value={formData.dealIntent || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, dealIntent: value }))}
          className="space-y-1.5"
        >
          {DEAL_INTENT_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="font-normal cursor-pointer text-xs">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Hard Exclusions */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{FIELD_HELPERS.exclusions.label}</Label>
        <ChipInput
          value={formData.exclusions || []}
          onChange={(value) => setFormData((prev) => ({ ...prev, exclusions: value }))}
          placeholder={FIELD_HELPERS.exclusions.placeholder}
          maxChips={20}
        />
      </div>

      {/* Include Keywords */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {FIELD_HELPERS.includeKeywords.label}
        </Label>
        <ChipInput
          value={formData.includeKeywords || []}
          onChange={(value) => setFormData((prev) => ({ ...prev, includeKeywords: value }))}
          placeholder={FIELD_HELPERS.includeKeywords.placeholder}
          maxChips={5}
        />
      </div>
    </div>
  );
};
