import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OWNER_TIMELINE_OPTIONS } from '@/lib/signup-field-options';
import type { BuyerTypeStepProps } from '../types';

type BusinessOwnerFieldsProps = Pick<
  BuyerTypeStepProps,
  'formData' | 'setFormData' | 'handleInputChange'
>;

export const BusinessOwnerFields = ({
  formData,
  setFormData,
  handleInputChange,
}: BusinessOwnerFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ownerIntent" className="text-xs text-muted-foreground">
          Why are you here? (≤140 chars)
        </Label>
        <Input
          id="ownerIntent"
          name="ownerIntent"
          placeholder='e.g., "Valuation", "Open to intros"'
          maxLength={140}
          value={formData.ownerIntent || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ownerTimeline" className="text-xs text-muted-foreground">
          Timeline
        </Label>
        <Select
          value={formData.ownerTimeline || ''}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, ownerTimeline: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {OWNER_TIMELINE_OPTIONS.map((option) => (
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
