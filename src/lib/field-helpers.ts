// Helper texts and descriptions for signup form fields

export const FIELD_HELPERS = {
  // Step 3 Profile Building Fields
  idealTargetDescription: {
    label: "Describe your ideal targets",
    description: "Help us understand what types of businesses you're looking to acquire. Be specific about industry, size, characteristics, etc.",
    placeholder: "I'm looking for profitable service businesses in the healthcare sector with stable customer bases and growth potential..."
  },

  businessCategories: {
    label: "Industry Focus",
    description: "Select the industries you're most interested in. You can choose multiple. This helps us show you relevant deals.",
    placeholder: "Select industries..."
  },

  targetLocations: {
    label: "Geographic Focus", 
    description: "Where are you looking to buy? Select broader regions for wider deal flow, or specific areas if you have location constraints.",
    placeholder: "Select target locations..."
  },

  // Revenue fields
  revenueRange: {
    label: "Target Company Revenue Range",
    description: "What annual revenue size are you targeting? This refers to the target company's yearly sales/revenue.",
    minLabel: "Minimum Revenue",
    maxLabel: "Maximum Revenue"
  },

  // Deal size fields  
  targetDealSize: {
    label: "Target Deal Size Range", 
    description: "What's the total transaction value you're targeting? This is the total amount you're willing to pay for the entire business.",
    minLabel: "Minimum Deal Size",
    maxLabel: "Maximum Deal Size"
  },

  // Investment size fields
  investmentSize: {
    label: "Investment Size",
    description: "How much capital are you looking to deploy per deal? This is your equity investment amount.",
    placeholder: "Select investment size"
  },

  specificBusinessSearch: {
    label: "Specific Business Requirements",
    description: "Looking for something very specific? Tell us exactly what you want - this helps us prioritize and send you hyper-targeted deals.",
    placeholder: "I'm looking for a non-union HVAC business with $2-5M EBITDA, established customer contracts..."
  },

  // New fields for Step 4
  dealIntent: {
    label: "Deal Intent",
    description: "What's your primary goal with acquisitions? This helps us understand your investment strategy.",
    placeholder: ""
  },

  exclusions: {
    label: "Hard Exclusions",
    description: "Industries, business types, or characteristics you want to avoid completely. We'll filter these out.",
    placeholder: "Enter exclusions (press Enter or comma to add)..."
  },

  includeKeywords: {
    label: "Include Keywords",
    description: "Specific keywords or business types you want to prioritize (max 5). We'll boost deals matching these.",
    placeholder: "Enter keywords (press Enter or comma to add)..."
  }
} as const;

// Industry category descriptions to help users understand what each includes
export const INDUSTRY_DESCRIPTIONS = {
  'Technology & Software': 'SaaS, software development, IT services, tech startups',
  'Healthcare & Medical': 'Medical practices, healthcare services, medical devices, telehealth',
  'Finance & Insurance': 'Financial services, insurance agencies, fintech, investment firms',
  'Manufacturing': 'Production facilities, industrial manufacturing, custom manufacturing',
  'Retail & E-commerce': 'Physical retail stores, online stores, marketplaces, consumer goods',
  'Real Estate': 'Property management, real estate services, commercial real estate',
  'Food & Beverage': 'Restaurants, food production, beverage companies, catering',
  'Professional Services': 'Consulting, accounting, legal, business services',
  'Construction': 'General contracting, specialty trades, construction services',
  'Transportation & Logistics': 'Shipping, freight, warehousing, delivery services',
  'Energy & Utilities': 'Renewable energy, utilities, oil & gas, power generation',
  'Education': 'Schools, training centers, educational services, e-learning',
  'Entertainment & Media': 'Media companies, entertainment venues, content creation',
  'Agriculture & Farming': 'Farms, agricultural services, food production, agtech',
  'Automotive': 'Auto dealerships, repair shops, automotive services',
  'Hospitality & Tourism': 'Hotels, travel services, tourism, event planning',
  'Home Services': 'Residential services, maintenance, cleaning, landscaping'
} as const;

// Location descriptions to help users understand geographic scope
export const LOCATION_DESCRIPTIONS = {
  "North America": "Businesses across the United States and Canada",
  "United States": "Focus on businesses located throughout the United States",
  "Canada": "Focus on businesses located in Canada", 
  "Northeast US": "New England and Mid-Atlantic states (NY, NJ, PA, CT, MA, etc.)",
  "Southeast US": "Southern and southeastern states (FL, GA, NC, SC, TN, etc.)",
  "Midwest US": "Central states and Great Lakes region (IL, OH, MI, WI, etc.)",
  "Southwest US": "Southwestern states (TX, AZ, NM, OK, etc.)",
  "Western US": "Western states and Pacific Coast (CA, OR, WA, NV, etc.)",
  "Europe": "Focus on businesses located in Europe",
  "United Kingdom": "Focus on businesses located in the UK",
  "Asia Pacific": "Focus on businesses in the Asia Pacific region",
  "Global/International": "Open to businesses worldwide, no geographic restrictions"
} as const;