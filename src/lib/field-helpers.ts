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