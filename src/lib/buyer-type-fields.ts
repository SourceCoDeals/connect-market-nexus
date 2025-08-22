import { BuyerType } from '@/types';

// Define exactly which fields should be shown for each buyer type based on signup flow
export const BUYER_TYPE_FIELD_MAPPINGS = {
  basic: [
    'first_name',
    'last_name', 
    'email',
    'phone_number',
    'company',
    'website',
    'linkedin_profile',
  ],
  profile: [
    'ideal_target_description',
    'business_categories',
    'target_locations',
    'specific_business_search',
  ],
  // Revenue ranges shown for all except privateEquity in signup
  revenue: [
    'revenue_range_min',
    'revenue_range_max',
  ],
  // Buyer-specific fields based on actual signup form
  corporate: [
    'estimated_revenue',
  ],
  privateEquity: [
    'fund_size',
    'investment_size', 
    'aum',
  ],
  familyOffice: [
    'fund_size',
    'investment_size',
    'aum',
  ],
  searchFund: [
    'is_funded',
    'funded_by', // Only if is_funded = 'yes'
    'target_company_size',
  ],
  individual: [
    'funding_source',
    'needs_loan',
    'ideal_target',
  ],
  independentSponsor: [
    'investment_size',
    'target_deal_size_min',
    'target_deal_size_max',
    'geographic_focus',
    'industry_expertise',
    'deal_structure_preference',
  ],
  admin: [
    // Admin users have no specific buyer fields
  ],
} as const;

// Get all relevant fields for a specific buyer type
export const getRelevantFieldsForBuyerType = (buyerType: BuyerType | 'admin'): string[] => {
  // Admin users only need basic fields
  if (buyerType === 'admin') {
    return [...BUYER_TYPE_FIELD_MAPPINGS.basic];
  }
  
  const buyerSpecificFields = BUYER_TYPE_FIELD_MAPPINGS[buyerType as BuyerType] || [];
  
  return [
    ...BUYER_TYPE_FIELD_MAPPINGS.basic,
    ...BUYER_TYPE_FIELD_MAPPINGS.profile,
    // Add revenue ranges for all except privateEquity and independentSponsor
    ...(buyerType !== 'privateEquity' && buyerType !== 'independentSponsor' ? BUYER_TYPE_FIELD_MAPPINGS.revenue : []),
    ...buyerSpecificFields,
  ];
};

// Get buyer-specific financial fields only
export const getBuyerSpecificFields = (buyerType: BuyerType | 'admin'): string[] => {
  if (buyerType === 'admin') return [];
  return [...(BUYER_TYPE_FIELD_MAPPINGS[buyerType as BuyerType] || [])];
};

// Check if a field is relevant for a buyer type
export const isFieldRelevantForBuyerType = (fieldKey: string, buyerType: BuyerType | 'admin'): boolean => {
  const relevantFields = getRelevantFieldsForBuyerType(buyerType);
  return relevantFields.includes(fieldKey);
};

// Field display labels
export const FIELD_LABELS = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone_number: 'Phone',
  company: 'Company',
  website: 'Website',
  linkedin_profile: 'LinkedIn',
  ideal_target_description: 'Target Description',
  business_categories: 'Business Categories',
  target_locations: 'Target Locations',
  specific_business_search: 'Specific Search',
  revenue_range_min: 'Min Revenue',
  revenue_range_max: 'Max Revenue',
  estimated_revenue: 'Estimated Revenue',
  fund_size: 'Fund Size',
  investment_size: 'Investment Size',
  aum: 'Assets Under Management',
  is_funded: 'Funding Status',
  funded_by: 'Funded By',
  target_company_size: 'Target Company Size',
  funding_source: 'Funding Source',
  needs_loan: 'SBA/Bank Loan',
  ideal_target: 'Ideal Target',
  target_deal_size_min: 'Min Deal Size',
  target_deal_size_max: 'Max Deal Size',
  geographic_focus: 'Geographic Focus',
  industry_expertise: 'Industry Expertise',
  deal_structure_preference: 'Deal Structure Preference',
} as const;

// Get field categories for organization
export const getFieldCategories = (buyerType: BuyerType | 'admin') => {
  // Admin users only show contact information
  if (buyerType === 'admin') {
    return {
      'Contact Information': BUYER_TYPE_FIELD_MAPPINGS.basic.filter(field => 
        ['first_name', 'last_name', 'email', 'phone_number', 'company', 'website', 'linkedin_profile'].includes(field)
      ),
    };
  }
  
  return {
    'Contact Information': BUYER_TYPE_FIELD_MAPPINGS.basic.filter(field => 
      ['first_name', 'last_name', 'email', 'phone_number', 'company', 'website', 'linkedin_profile'].includes(field)
    ),
    'Business Profile': [
      ...BUYER_TYPE_FIELD_MAPPINGS.profile,
      ...(buyerType !== 'privateEquity' && buyerType !== 'independentSponsor' ? BUYER_TYPE_FIELD_MAPPINGS.revenue : []),
    ],
    'Financial Information': getBuyerSpecificFields(buyerType),
  };
};