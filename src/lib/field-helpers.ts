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
  'United States': 'Nationwide opportunities across all US states',
  'Northeast US': 'Maine, New Hampshire, Vermont, Massachusetts, Rhode Island, Connecticut, New York, New Jersey, Pennsylvania',
  'Southeast US': 'Delaware, Maryland, Virginia, West Virginia, Kentucky, Tennessee, North Carolina, South Carolina, Georgia, Florida, Alabama, Mississippi, Arkansas, Louisiana',
  'Southwest US': 'Texas, Oklahoma, New Mexico, Arizona',
  'West Coast US': 'California, Oregon, Washington',
  'Northwest US': 'Washington, Oregon, Idaho, Alaska',
  'Pacific Northwest US': 'Washington, Oregon, Northern California',
  'Midwest US': 'Ohio, Indiana, Illinois, Michigan, Wisconsin, Minnesota, Iowa, Missouri, North Dakota, South Dakota, Nebraska, Kansas',
  'Mountain West US': 'Montana, Idaho, Wyoming, Colorado, Utah, Nevada',
  'Great Lakes Region': 'Michigan, Wisconsin, Illinois, Indiana, Ohio, Pennsylvania, New York, Minnesota',
  'California': 'The entire state of California - largest economy in the US',
  'Texas': 'The entire state of Texas - second largest state economy',
  'New York': 'The entire state of New York including NYC metro area',
  'Florida': 'The entire state of Florida including Miami and Tampa metros',
  'Eastern Canada': 'Quebec, Ontario, New Brunswick, Nova Scotia, Prince Edward Island, Newfoundland and Labrador',
  'Western Canada': 'Manitoba, Saskatchewan, Alberta, British Columbia, Northwest Territories, Yukon, Nunavut',
  'Ontario': 'Canadas most populous province, includes Toronto and Ottawa',
  'Quebec': 'French-speaking province, includes Montreal and Quebec City',
  'British Columbia': 'Westernmost province, includes Vancouver',
  'United Kingdom': 'England, Scotland, Wales, Northern Ireland',
  'Western Europe': 'France, Germany, Italy, Spain, Netherlands, Belgium, Switzerland, Austria, Portugal',
  'Eastern Europe': 'Poland, Czech Republic, Hungary, Slovakia, Romania, Bulgaria, Croatia, Slovenia',
  'International': 'Global opportunities outside North America'
} as const;