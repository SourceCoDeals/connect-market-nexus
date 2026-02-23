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
import { InvestmentSizeSelect } from '@/components/ui/investment-size-select';
import { ChipInput } from '@/components/ui/chip-input';
import { FIELD_HELPERS } from '@/lib/field-helpers';
import { DISCRETION_TYPE_OPTIONS } from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type FamilyOfficeFieldsProps = Pick<BuyerTypeStepProps, 'formData' | 'setFormData'>;

export const FamilyOfficeFields = ({ formData, setFormData }: FamilyOfficeFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fundSize" className="text-xs text-muted-foreground">
          Fund Size
        </Label>
        <EnhancedCurrencyInput
          value={formData.fundSize}
          onChange={(value) => setFormData((prev) => ({ ...prev, fundSize: value }))}
          fieldType="fund"
          currencyMode="millions"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="investmentSize" className="text-xs text-muted-foreground">
          {FIELD_HELPERS.investmentSize.label}
        </Label>
        <InvestmentSizeSelect
          value={formData.investmentSize}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
          placeholder="Select investment size ranges..."
          multiSelect={true}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="aum" className="text-xs text-muted-foreground">
          Assets Under Management
        </Label>
        <EnhancedCurrencyInput
          value={formData.aum}
          onChange={(value) => setFormData((prev) => ({ ...prev, aum: value }))}
          fieldType="aum"
          currencyMode="millions"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="discretionType" className="text-xs text-muted-foreground">
          Decision authority
        </Label>
        <Select
          value={formData.discretionType || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, discretionType: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {DISCRETION_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="permanentCapital"
          checked={formData.permanentCapital || false}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, permanentCapital: checked as boolean }))
          }
        />
        <Label htmlFor="permanentCapital" className="text-xs font-normal">
          Permanent capital
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Operating company add-ons</Label>
        <ChipInput
          value={formData.operatingCompanyTargets || []}
          onChange={(companies) =>
            setFormData((prev) => ({ ...prev, operatingCompanyTargets: companies.slice(0, 3) }))
          }
          placeholder="Enter company name and press Enter"
        />
      </div>
    </div>
  );
};
