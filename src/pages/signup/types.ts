import { BuyerType } from '@/types';

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  company: string;
  website: string;
  linkedinProfile: string;
  phoneNumber: string;
  jobTitle?: string;
  buyerType: BuyerType | '';
  // Buyer type specific fields - flattened for proper mapping
  estimatedRevenue: string;
  fundSize: string;
  investmentSize: string[];
  aum: string;
  isFunded: string;
  fundedBy: string;
  targetCompanySize: string;
  fundingSource: string;
  needsLoan: string;
  idealTarget: string;
  // Profile fields
  idealTargetDescription: string;
  businessCategories: string[];
  targetLocations: string[];
  revenueRangeMin: string;
  revenueRangeMax: string;
  specificBusinessSearch: string;
  // Independent sponsor specific fields
  targetDealSizeMin: string;
  targetDealSizeMax: string;
  geographicFocus: string;
  industryExpertise: string;
  dealStructurePreference: string;
  // New comprehensive signup fields
  portfolioCompanyAddon?: string;
  deployingCapitalNow?: string;
  owningBusinessUnit?: string;
  dealSizeBand?: string;
  integrationPlan?: string[];
  corpdevIntent?: string;
  discretionType?: string;
  permanentCapital?: boolean;
  operatingCompanyTargets?: string[];
  committedEquityBand?: string;
  equitySource?: string[];
  flexSubxmEbitda?: boolean;
  backersSummary?: string;
  deploymentTiming?: string;
  searchType?: string;
  acqEquityBand?: string;
  financingPlan?: string[];
  flexSub2mEbitda?: boolean;
  anchorInvestorsSummary?: string;
  searchStage?: string;
  onBehalfOfBuyer?: string;
  buyerRole?: string;
  buyerOrgUrl?: string;
  mandateBlurb?: string;
  ownerIntent?: string;
  ownerTimeline?: string;
  usesBank?: string;
  maxEquityToday?: string;
  // New Step 4 fields
  dealIntent?: string;
  exclusions?: string[];
  includeKeywords?: string[];
  // Referral source tracking (Step 3)
  referralSource?: string;
  referralSourceDetail?: string;
  // Deal sourcing questions (Step 3)
  dealSourcingMethods?: string[];
  targetAcquisitionVolume?: string;
}

export type FormDataUpdater = React.Dispatch<React.SetStateAction<SignupFormData>>;

export interface AccountInfoStepProps {
  formData: SignupFormData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface PersonalDetailsStepProps {
  formData: SignupFormData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface BuyerTypeStepProps {
  formData: SignupFormData;
  setFormData: FormDataUpdater;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBuyerTypeChange: (value: string) => void;
}

export interface BuyerProfileStepProps {
  formData: SignupFormData;
  setFormData: FormDataUpdater;
}

export interface SignupSidePanelProps {
  bradDaughertyImage: string;
  sfcLogo: string;
}
