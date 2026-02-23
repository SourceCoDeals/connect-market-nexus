import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ON_BEHALF_OPTIONS, BUYER_ROLE_OPTIONS } from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type AdvisorFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const AdvisorFields = ({ formData, setFormData, handleInputChange }: AdvisorFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="onBehalfOfBuyer" className="text-xs text-muted-foreground">
          Inquiring on behalf of a capitalized buyer?
        </Label>
        <Select
          value={formData.onBehalfOfBuyer || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, onBehalfOfBuyer: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {ON_BEHALF_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.onBehalfOfBuyer === 'yes' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="buyerRole" className="text-xs text-muted-foreground">
              Buyer role
            </Label>
            <Select
              value={formData.buyerRole || ''}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, buyerRole: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {BUYER_ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buyerOrgUrl" className="text-xs text-muted-foreground">
              Buyer organization website
            </Label>
            <Input
              id="buyerOrgUrl"
              name="buyerOrgUrl"
              type="url"
              placeholder="https://www.buyercompany.com"
              value={formData.buyerOrgUrl || ''}
              onChange={handleInputChange}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="mandateBlurb" className="text-xs text-muted-foreground">
          Mandate in one line (≤140 chars)
        </Label>
        <Input
          id="mandateBlurb"
          name="mandateBlurb"
          placeholder="e.g., Lower middle market tech services add-ons for PE portfolio"
          maxLength={140}
          value={formData.mandateBlurb || ''}
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
};
