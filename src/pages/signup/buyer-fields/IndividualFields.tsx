import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  INDIVIDUAL_FUNDING_SOURCE_OPTIONS,
  USES_BANK_FINANCE_OPTIONS,
  MAX_EQUITY_TODAY_OPTIONS,
} from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type IndividualFieldsProps = Pick<BuyerTypeStepProps, 'formData' | 'setFormData'>;

export const IndividualFields = ({ formData, setFormData }: IndividualFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fundingSource" className="text-xs text-muted-foreground">
          Funding source
        </Label>
        <Select
          value={formData.fundingSource}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, fundingSource: value }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="usesBank" className="text-xs text-muted-foreground">
          Will you use SBA/bank financing?
        </Label>
        <Select
          value={formData.usesBank || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, usesBank: value }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {USES_BANK_FINANCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxEquityToday" className="text-xs text-muted-foreground">
          Max equity you can commit today
        </Label>
        <Select
          value={formData.maxEquityToday || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, maxEquityToday: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {MAX_EQUITY_TODAY_OPTIONS.map((option) => (
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
