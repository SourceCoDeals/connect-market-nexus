import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BUYER_TYPE_OPTIONS } from './constants';
import { CorporateFields } from './buyer-fields/CorporateFields';
import { PrivateEquityFields } from './buyer-fields/PrivateEquityFields';
import { FamilyOfficeFields } from './buyer-fields/FamilyOfficeFields';
import { SearchFundFields } from './buyer-fields/SearchFundFields';
import { IndividualFields } from './buyer-fields/IndividualFields';
import { IndependentSponsorFields } from './buyer-fields/IndependentSponsorFields';
import { AdvisorFields } from './buyer-fields/AdvisorFields';
import { BusinessOwnerFields } from './buyer-fields/BusinessOwnerFields';
import type { BuyerTypeStepProps } from './types';

export const BuyerTypeStep = ({
  formData,
  setFormData,
  handleInputChange,
  handleBuyerTypeChange,
}: BuyerTypeStepProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="buyerType" className="text-xs text-muted-foreground">
          Type of Buyer
        </Label>
        <Select onValueChange={handleBuyerTypeChange} value={formData.buyerType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {BUYER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conditional fields based on buyer type */}
      {formData.buyerType === 'corporate' && (
        <CorporateFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}

      {formData.buyerType === 'privateEquity' && (
        <PrivateEquityFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}

      {formData.buyerType === 'familyOffice' && (
        <FamilyOfficeFields formData={formData} setFormData={setFormData} />
      )}

      {formData.buyerType === 'searchFund' && (
        <SearchFundFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}

      {formData.buyerType === 'individual' && (
        <IndividualFields formData={formData} setFormData={setFormData} />
      )}

      {formData.buyerType === 'independentSponsor' && (
        <IndependentSponsorFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}

      {formData.buyerType === 'advisor' && (
        <AdvisorFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}

      {formData.buyerType === 'businessOwner' && (
        <BusinessOwnerFields
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
        />
      )}
    </div>
  );
};
