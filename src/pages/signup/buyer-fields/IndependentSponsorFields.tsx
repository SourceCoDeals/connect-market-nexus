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
  COMMITTED_EQUITY_BAND_OPTIONS,
  EQUITY_SOURCE_OPTIONS,
  DEPLOYMENT_TIMING_OPTIONS,
} from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type IndependentSponsorFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const IndependentSponsorFields = ({
  formData,
  setFormData,
  handleInputChange,
}: IndependentSponsorFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="committedEquityBand" className="text-xs text-muted-foreground">
          Committed equity available
        </Label>
        <Select
          value={formData.committedEquityBand || ''}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, committedEquityBand: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {COMMITTED_EQUITY_BAND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Source of equity</Label>
        <div className="grid grid-cols-2 gap-2">
          {EQUITY_SOURCE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`equity-source-${option.value}`}
                checked={(formData.equitySource || []).includes(option.value)}
                onCheckedChange={(checked) => {
                  const current = formData.equitySource || [];
                  const updated = checked
                    ? [...current, option.value]
                    : current.filter((item) => item !== option.value);
                  setFormData((prev) => ({ ...prev, equitySource: updated }));
                }}
              />
              <Label htmlFor={`equity-source-${option.value}`} className="text-xs font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="flexSubxmEbitda"
          checked={formData.flexSubxmEbitda || false}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, flexSubxmEbitda: checked as boolean }))
          }
        />
        <Label htmlFor="flexSubxmEbitda" className="text-xs font-normal">
          Flexible on size?
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="backersSummary" className="text-xs text-muted-foreground">
          Representative backers
        </Label>
        <Input
          id="backersSummary"
          name="backersSummary"
          placeholder="e.g., Smith Capital; Oak Family Office"
          value={formData.backersSummary || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deploymentTiming" className="text-xs text-muted-foreground">
          Readiness window
        </Label>
        <Select
          value={formData.deploymentTiming || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, deploymentTiming: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {DEPLOYMENT_TIMING_OPTIONS.map((option) => (
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
