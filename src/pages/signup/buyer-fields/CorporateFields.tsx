import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EnhancedCurrencyInput } from '@/components/ui/enhanced-currency-input';
import {
  DEAL_SIZE_BAND_OPTIONS,
  INTEGRATION_PLAN_OPTIONS,
  CORPDEV_INTENT_OPTIONS,
} from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type CorporateFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const CorporateFields = ({
  formData,
  setFormData,
  handleInputChange,
}: CorporateFieldsProps) => {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="estimatedRevenue" className="text-xs text-muted-foreground">
          Estimated Revenue
        </Label>
        <EnhancedCurrencyInput
          value={formData.estimatedRevenue}
          onChange={(value) => setFormData((prev) => ({ ...prev, estimatedRevenue: value }))}
          fieldType="revenue"
          currencyMode="millions"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="owningBusinessUnit" className="text-xs text-muted-foreground">
          Business Unit
        </Label>
        <Input
          id="owningBusinessUnit"
          name="owningBusinessUnit"
          placeholder="e.g., Digital Services Division"
          value={formData.owningBusinessUnit || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dealSizeBand" className="text-xs text-muted-foreground">
          Deal Size (EV)
        </Label>
        <Select
          value={formData.dealSizeBand || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, dealSizeBand: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {DEAL_SIZE_BAND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Integration Plan</Label>
        <div className="grid grid-cols-2 gap-2">
          {INTEGRATION_PLAN_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`integration-${option.value}`}
                checked={(formData.integrationPlan || []).includes(option.value)}
                onCheckedChange={(checked) => {
                  const current = formData.integrationPlan || [];
                  const updated = checked
                    ? [...current, option.value]
                    : current.filter((item) => item !== option.value);
                  setFormData((prev) => ({ ...prev, integrationPlan: updated }));
                }}
              />
              <Label htmlFor={`integration-${option.value}`} className="text-xs font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="corpdevIntent" className="text-xs text-muted-foreground">
          Speed/Intent
        </Label>
        <Select
          value={formData.corpdevIntent || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, corpdevIntent: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {CORPDEV_INTENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
