import type { SignupFormData } from './types';

export const SIGNUP_STEPS = [
  'Account Information',
  'Personal Details',
  'How did you hear about us?',
  'Buyer Type',
  'Buyer Profile',
];

export const BUYER_TYPE_OPTIONS = [
  {
    value: 'corporate',
    label: 'Corporate Development (Strategic)',
    description: 'Corporate buyers seeking strategic acquisitions',
  },
  {
    value: 'privateEquity',
    label: 'Private Equity',
    description: 'Investment funds focused on acquiring and growing companies',
  },
  {
    value: 'familyOffice',
    label: 'Family Office',
    description: 'Private wealth management offices making direct investments',
  },
  {
    value: 'searchFund',
    label: 'Search Fund',
    description: 'Entrepreneur-led acquisition vehicles',
  },
  {
    value: 'individual',
    label: 'Individual Investor',
    description: 'High-net-worth individuals making personal investments',
  },
  {
    value: 'independentSponsor',
    label: 'Independent Sponsor',
    description: 'Deal-by-deal investment professionals',
  },
  {
    value: 'advisor',
    label: 'Advisor / Banker',
    description: 'Investment bankers and M&A advisors',
  },
  {
    value: 'businessOwner',
    label: 'Business Owner',
    description: 'Current business owners exploring opportunities',
  },
];

export const INITIAL_FORM_DATA: SignupFormData = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  company: '',
  website: '',
  linkedinProfile: '',
  phoneNumber: '',
  jobTitle: '',
  buyerType: '',
  // Buyer type specific fields
  estimatedRevenue: '',
  fundSize: '',
  investmentSize: [],
  aum: '',
  isFunded: '',
  fundedBy: '',
  targetCompanySize: '',
  fundingSource: '',
  needsLoan: '',
  idealTarget: '',
  // Profile fields
  idealTargetDescription: '',
  businessCategories: [],
  targetLocations: [],
  revenueRangeMin: '',
  revenueRangeMax: '',
  specificBusinessSearch: '',
  // Independent sponsor specific fields
  targetDealSizeMin: '',
  targetDealSizeMax: '',
  geographicFocus: '',
  industryExpertise: '',
  dealStructurePreference: '',
  // New comprehensive signup fields
  portfolioCompanyAddon: '',
  deployingCapitalNow: '',
  owningBusinessUnit: '',
  dealSizeBand: '',
  integrationPlan: [],
  corpdevIntent: '',
  discretionType: '',
  permanentCapital: false,
  operatingCompanyTargets: [],
  committedEquityBand: '',
  equitySource: [],
  flexSubxmEbitda: false,
  backersSummary: '',
  deploymentTiming: '',
  searchType: '',
  acqEquityBand: '',
  financingPlan: [],
  flexSub2mEbitda: false,
  anchorInvestorsSummary: '',
  searchStage: '',
  onBehalfOfBuyer: '',
  buyerRole: '',
  buyerOrgUrl: '',
  mandateBlurb: '',
  ownerIntent: '',
  ownerTimeline: '',
  usesBank: '',
  maxEquityToday: '',
  // New Step 4 fields
  dealIntent: '',
  exclusions: [],
  includeKeywords: [],
  // Referral source tracking (Step 3)
  referralSource: '',
  referralSourceDetail: '',
  // Deal sourcing questions (Step 3)
  dealSourcingMethods: [],
  targetAcquisitionVolume: '',
};
