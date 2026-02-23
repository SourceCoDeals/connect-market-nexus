import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EnhancedCurrencyInput } from '@/components/ui/enhanced-currency-input';
import { InvestmentSizeSelect } from '@/components/ui/investment-size-select';
import { FIELD_HELPERS } from '@/lib/field-helpers';
import { DEPLOYING_CAPITAL_OPTIONS } from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type PrivateEquityFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const PrivateEquityFields = ({
  formData,
  setFormData,
  handleInputChange,
}: PrivateEquityFieldsProps) => {
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
        <Label htmlFor="portfolioCompanyAddon" className="text-xs text-muted-foreground">
          Portfolio company add-on
        </Label>
        <Input
          id="portfolioCompanyAddon"
          name="portfolioCompanyAddon"
          placeholder="e.g., ABC Manufacturing Co."
          value={formData.portfolioCompanyAddon || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deployingCapitalNow" className="text-xs text-muted-foreground">
          Deploying capital now?
        </Label>
        <Select
          value={formData.deployingCapitalNow || ''}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, deployingCapitalNow: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {DEPLOYING_CAPITAL_OPTIONS.map((option) => (
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
