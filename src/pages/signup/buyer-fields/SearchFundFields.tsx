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
import {
  SEARCH_TYPE_OPTIONS,
  ACQ_EQUITY_BAND_OPTIONS,
  FINANCING_PLAN_OPTIONS,
  SEARCH_STAGE_OPTIONS,
} from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type SearchFundFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const SearchFundFields = ({
  formData,
  setFormData,
  handleInputChange,
}: SearchFundFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="searchType" className="text-xs text-muted-foreground">
          Search type
        </Label>
        <Select
          value={formData.searchType || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, searchType: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acqEquityBand" className="text-xs text-muted-foreground">
          Equity available at close
        </Label>
        <Select
          value={formData.acqEquityBand || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, acqEquityBand: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {ACQ_EQUITY_BAND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Financing plan</Label>
        <div className="grid grid-cols-2 gap-2">
          {FINANCING_PLAN_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`financing-${option.value}`}
                checked={(formData.financingPlan || []).includes(option.value)}
                onCheckedChange={(checked) => {
                  const current = formData.financingPlan || [];
                  const updated = checked
                    ? [...current, option.value]
                    : current.filter((item) => item !== option.value);
                  setFormData((prev) => ({ ...prev, financingPlan: updated }));
                }}
              />
              <Label htmlFor={`financing-${option.value}`} className="text-xs font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="flexSub2mEbitda"
          checked={formData.flexSub2mEbitda || false}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, flexSub2mEbitda: checked as boolean }))
          }
        />
        <Label htmlFor="flexSub2mEbitda" className="text-xs font-normal">
          Flexible on size? (can pursue &lt; $2M EBITDA)
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="anchorInvestorsSummary" className="text-xs text-muted-foreground">
          Anchor investors / backers
        </Label>
        <Input
          id="anchorInvestorsSummary"
          name="anchorInvestorsSummary"
          placeholder="e.g., XYZ Capital; ABC Family Office"
          value={formData.anchorInvestorsSummary || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="searchStage" className="text-xs text-muted-foreground">
          Stage of search
        </Label>
        <Select
          value={formData.searchStage || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, searchStage: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_STAGE_OPTIONS.map((option) => (
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
