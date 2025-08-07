
/**
 * Advanced utility functions for parsing financial data and business insights from descriptions
 */

export interface ExtractedFinancials {
  revenue?: {
    value: number;
    display: string;
    confidence: number;
  };
  ebitda?: {
    value: number;
    display: string;
    confidence: number;
  };
  margin?: {
    value: number;
    display: string;
    confidence: number;
  };
  revenueModel?: string;
  marketPosition?: string;
  growthDrivers?: string[];
  strategicAssets?: string[];
  competitiveAdvantages?: string[];
  marketTrends?: string[];
  riskFactors?: string[];
  customerBase?: string;
  technology?: string[];
  keyMetrics?: { [key: string]: string };
}

export interface RiskAssessment {
  level: 'Low' | 'Low-Medium' | 'Medium' | 'Medium-High' | 'High';
  factors: string[];
  industryRisks: string[];
  mitigationFactors: string[];
  confidence: number;
}

export interface CustomInvestmentThesis {
  overview: string;
  keyStrengths: string[];
  growthOpportunity: string;
  marketPosition: string;
  competitiveAdvantages: string[];
  investmentHighlights: string[];
  riskAssessment: RiskAssessment;
  confidence: number;
}

// Standardized geographic regions
export const STANDARDIZED_LOCATIONS = [
  'Northeast US',
  'Southeast US', 
  'Southwest US',
  'West Coast US',
  'Midwest US',
  'Mountain West US',
  'Eastern Canada',
  'Western Canada',
  'United Kingdom',
  'Western Europe',
  'Eastern Europe',
  'Asia Pacific',
  'Australia/New Zealand',
  'International'
] as const;

export type StandardizedLocation = typeof STANDARDIZED_LOCATIONS[number];

// Standardized business categories
export const STANDARDIZED_CATEGORIES = [
  'Technology',
  'Healthcare',
  'Finance & Insurance',
  'Manufacturing',
  'Retail & E-commerce',
  'Real Estate',
  'Food & Beverage',
  'Professional Services',
  'Construction',
  'Transportation & Logistics',
  'Energy & Utilities',
  'Education',
  'Entertainment & Media',
  'Agriculture',
  'Automotive',
  'Telecommunications',
  'Aerospace & Defense',
  'Chemicals',
  'Consumer Goods',
  'Other'
] as const;

export type StandardizedCategory = typeof STANDARDIZED_CATEGORIES[number];

export interface InvestmentThesis {
  overview: string;
  keyStrengths: string[];
  growthOpportunity: string;
  marketPosition: string;
}

/**
 * Extract comprehensive financial metrics and business insights from description text
 */
export function extractFinancialMetrics(description: string): ExtractedFinancials {
  const metrics: ExtractedFinancials = {};
  const lowerDesc = description.toLowerCase();
  
  // Enhanced revenue extraction patterns
  const revenuePatterns = [
    /\$(\d+(?:\.\d+)?)\s*M\+?\s*(?:annual\s+)?revenue/i,
    /(?:annual\s+)?revenue.*?\$(\d+(?:\.\d+)?)\s*M/i,
    /(\d+(?:\.\d+)?)\s*million.*(?:annual\s+)?revenue/i,
    /generates.*?\$(\d+(?:\.\d+)?)\s*M/i,
  ];
  
  for (const pattern of revenuePatterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1]) * 1000000;
      metrics.revenue = {
        value,
        display: `$${match[1]}M`,
        confidence: 0.9
      };
      break;
    }
  }
  
  // Enhanced EBITDA extraction patterns
  const ebitdaPatterns = [
    /\$(\d+(?:\.\d+)?)\s*M\+?\s*EBITDA/i,
    /EBITDA.*?\$(\d+(?:\.\d+)?)\s*M/i,
    /(\d+(?:\.\d+)?)\s*million.*EBITDA/i,
    /operating profit.*?\$(\d+(?:\.\d+)?)\s*M/i,
  ];
  
  for (const pattern of ebitdaPatterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1]) * 1000000;
      metrics.ebitda = {
        value,
        display: `$${match[1]}M`,
        confidence: 0.9
      };
      break;
    }
  }
  
  // Enhanced margin extraction
  const marginPatterns = [
    /(\d+(?:\.\d+)?)\%\s*(?:gross\s+|net\s+|EBITDA\s+)?margin/i,
    /margin.*?(\d+(?:\.\d+)?)\%/i,
    /profitability.*?(\d+(?:\.\d+)?)\%/i,
  ];
  
  for (const pattern of marginPatterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      metrics.margin = {
        value,
        display: `${value}%`,
        confidence: 0.8
      };
      break;
    }
  }
  
  // Revenue model analysis
  const revenueModels = [
    { pattern: /recurring|subscription|saas|monthly|annual contract/i, model: 'Recurring Revenue Model' },
    { pattern: /project[\s-]based|contract|consulting|services/i, model: 'Project-Based Revenue' },
    { pattern: /retail|e[\s-]?commerce|sales|transaction/i, model: 'Transactional Revenue' },
    { pattern: /licensing|royalty|franchise/i, model: 'Licensing Revenue' },
  ];
  
  for (const { pattern, model } of revenueModels) {
    if (pattern.test(description)) {
      metrics.revenueModel = model;
      break;
    }
  }
  
  // Market position analysis
  const positionIndicators = [
    { pattern: /market leader|leading position|#1|dominant/i, position: 'Market Leading Position' },
    { pattern: /established|well[\s-]known|recognized/i, position: 'Established Market Position' },
    { pattern: /regional leader|regional presence/i, position: 'Strong Regional Position' },
    { pattern: /niche|specialized|boutique/i, position: 'Niche Market Position' },
  ];
  
  for (const { pattern, position } of positionIndicators) {
    if (pattern.test(description)) {
      metrics.marketPosition = position;
      break;
    }
  }
  
  // Growth drivers analysis
  const growthKeywords = [
    'market expansion', 'geographic expansion', 'digital transformation', 'automation',
    'new products', 'acquisitions', 'organic growth', 'market consolidation',
    'infrastructure investment', 'technology upgrade', 'customer base growth'
  ];
  metrics.growthDrivers = growthKeywords.filter(keyword => 
    lowerDesc.includes(keyword.toLowerCase())
  );
  
  // Strategic assets analysis
  const assetKeywords = [
    'proprietary technology', 'patents', 'equipment', 'fleet', 'real estate',
    'customer relationships', 'long-term contracts', 'licenses', 'certifications',
    'brand recognition', 'distribution network', 'manufacturing facility'
  ];
  metrics.strategicAssets = assetKeywords.filter(keyword => 
    lowerDesc.includes(keyword.toLowerCase())
  );
  
  // Competitive advantages
  const advantageKeywords = [
    'first mover', 'barriers to entry', 'economies of scale', 'network effects',
    'switching costs', 'regulatory moat', 'brand loyalty', 'cost leadership',
    'differentiation', 'innovation', 'exclusive agreements'
  ];
  metrics.competitiveAdvantages = advantageKeywords.filter(keyword => 
    lowerDesc.includes(keyword.toLowerCase())
  );
  
  // Market trends
  const trendKeywords = [
    'growing demand', 'market growth', 'demographic trends', 'digitization',
    'sustainability', 'automation trend', 'consolidation', 'regulatory tailwinds'
  ];
  metrics.marketTrends = trendKeywords.filter(keyword => 
    lowerDesc.includes(keyword.toLowerCase())
  );
  
  // Risk factors
  const riskKeywords = [
    'competition', 'regulatory risk', 'customer concentration', 'cyclical',
    'technology disruption', 'economic sensitivity', 'key person risk'
  ];
  metrics.riskFactors = riskKeywords.filter(keyword => 
    lowerDesc.includes(keyword.toLowerCase())
  );
  
  // Customer base analysis
  if (lowerDesc.includes('diversified customer') || lowerDesc.includes('broad customer base')) {
    metrics.customerBase = 'Diversified Customer Base';
  } else if (lowerDesc.includes('concentrated') || lowerDesc.includes('key customers')) {
    metrics.customerBase = 'Concentrated Customer Base';
  } else if (lowerDesc.includes('b2b') || lowerDesc.includes('business-to-business')) {
    metrics.customerBase = 'B2B Customer Focus';
  } else if (lowerDesc.includes('consumer') || lowerDesc.includes('b2c')) {
    metrics.customerBase = 'Consumer Market Focus';
  }
  
  return metrics;
}

/**
 * Generate comprehensive risk assessment based on business description and financials
 */
export function generateRiskAssessment(
  description: string, 
  category: string, 
  revenue: number, 
  ebitda: number,
  extractedMetrics: ExtractedFinancials
): RiskAssessment {
  const lowerDesc = description.toLowerCase();
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  
  let riskLevel: RiskAssessment['level'] = 'Medium';
  const factors: string[] = [];
  const industryRisks: string[] = [];
  const mitigationFactors: string[] = [];
  let confidence = 0.7;
  
  // Financial stability assessment
  if (ebitdaMargin >= 20 && revenue >= 10000000) {
    riskLevel = 'Low';
    mitigationFactors.push('Strong financial performance with healthy margins');
    confidence += 0.1;
  } else if (ebitdaMargin >= 15 && revenue >= 5000000) {
    riskLevel = 'Low-Medium';
    mitigationFactors.push('Solid financial fundamentals');
  } else if (ebitdaMargin < 5 || revenue < 1000000) {
    riskLevel = 'Medium-High';
    factors.push('Lower profitability margins require operational improvements');
  }
  
  // Industry-specific risks
  const industryRiskProfiles = {
    'Technology': ['Technology disruption risk', 'Rapid innovation cycles', 'Talent competition'],
    'Healthcare': ['Regulatory compliance risk', 'Reimbursement changes', 'Liability exposure'],
    'Manufacturing': ['Commodity price volatility', 'Supply chain disruption', 'Capital intensity'],
    'Services': ['People dependency', 'Client concentration risk', 'Economic sensitivity'],
    'Retail': ['Consumer spending sensitivity', 'E-commerce competition', 'Inventory management'],
    'Food & Beverage': ['Food safety regulations', 'Supply chain complexity', 'Consumer preference shifts']
  };
  
  if (industryRiskProfiles[category as keyof typeof industryRiskProfiles]) {
    industryRisks.push(...industryRiskProfiles[category as keyof typeof industryRiskProfiles]);
  }
  
  // Business model risks
  if (extractedMetrics.riskFactors?.includes('customer concentration')) {
    factors.push('Customer concentration creates revenue dependency risk');
    if (riskLevel === 'Low') riskLevel = 'Low-Medium';
    else if (riskLevel === 'Low-Medium') riskLevel = 'Medium';
  }
  
  if (extractedMetrics.riskFactors?.includes('competition')) {
    factors.push('Competitive market environment');
  }
  
  if (extractedMetrics.riskFactors?.includes('cyclical')) {
    factors.push('Business cyclicality affects revenue predictability');
    if (riskLevel === 'Low') riskLevel = 'Low-Medium';
  }
  
  // Mitigation factors
  if (extractedMetrics.strategicAssets?.length > 0) {
    mitigationFactors.push(`Strategic assets provide competitive protection: ${extractedMetrics.strategicAssets.slice(0, 2).join(', ')}`);
    confidence += 0.1;
  }
  
  if (extractedMetrics.competitiveAdvantages?.length > 0) {
    mitigationFactors.push(`Competitive advantages reduce market risk`);
    confidence += 0.1;
  }
  
  if (extractedMetrics.revenueModel === 'Recurring Revenue Model') {
    mitigationFactors.push('Recurring revenue model provides cash flow predictability');
    if (riskLevel === 'Medium-High') riskLevel = 'Medium';
    else if (riskLevel === 'Medium') riskLevel = 'Low-Medium';
  }
  
  if (extractedMetrics.marketPosition?.includes('Leading')) {
    mitigationFactors.push('Market leading position provides defensive characteristics');
    confidence += 0.1;
  }
  
  return {
    level: riskLevel,
    factors: factors.length > 0 ? factors : ['Standard business and market risks apply'],
    industryRisks,
    mitigationFactors: mitigationFactors.length > 0 ? mitigationFactors : ['Business fundamentals support investment case'],
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Generate custom investment thesis from business description
 */
export function generateCustomInvestmentThesis(
  description: string,
  category: string,
  location: string,
  revenue: number,
  ebitda: number
): CustomInvestmentThesis {
  const extractedMetrics = extractFinancialMetrics(description);
  const riskAssessment = generateRiskAssessment(description, category, revenue, ebitda, extractedMetrics);
  
  // Generate overview based on extracted insights
  let overview = '';
  if (extractedMetrics.marketPosition) {
    overview = `${extractedMetrics.marketPosition.replace(' Position', '')} business `;
  } else {
    overview = 'Well-positioned business ';
  }
  
  if (extractedMetrics.revenueModel) {
    overview += `with ${extractedMetrics.revenueModel.toLowerCase()} `;
  }
  
  overview += `operating in the ${category.toLowerCase()} sector. `;
  
  if (revenue > 0) {
    overview += `Generates $${(revenue / 1000000).toFixed(1)}M in annual revenue `;
    if (ebitda > 0) {
      const margin = (ebitda / revenue) * 100;
      overview += `with ${margin.toFixed(1)}% EBITDA margins.`;
    }
  }
  
  // Key strengths from extracted data
  const keyStrengths: string[] = [];
  
  if (extractedMetrics.strategicAssets?.length > 0) {
    keyStrengths.push(`Strategic assets: ${extractedMetrics.strategicAssets.slice(0, 2).join(', ')}`);
  }
  
  if (extractedMetrics.competitiveAdvantages?.length > 0) {
    keyStrengths.push(`Competitive advantages in ${extractedMetrics.competitiveAdvantages.slice(0, 2).join(', ')}`);
  }
  
  if (extractedMetrics.customerBase) {
    keyStrengths.push(extractedMetrics.customerBase);
  }
  
  if (revenue >= 10000000 && ebitda > 0) {
    keyStrengths.push('Proven scalability with strong financial performance');
  }
  
  // Investment highlights
  const investmentHighlights: string[] = [];
  
  if (extractedMetrics.growthDrivers?.length > 0) {
    investmentHighlights.push(`Growth drivers: ${extractedMetrics.growthDrivers.slice(0, 2).join(', ')}`);
  }
  
  if (extractedMetrics.marketTrends?.length > 0) {
    investmentHighlights.push(`Favorable market trends: ${extractedMetrics.marketTrends.slice(0, 2).join(', ')}`);
  }
  
  if (extractedMetrics.revenueModel === 'Recurring Revenue Model') {
    investmentHighlights.push('Predictable recurring revenue streams');
  }
  
  // Growth opportunity
  let growthOpportunity = '';
  if (extractedMetrics.growthDrivers?.length > 0) {
    growthOpportunity = `Multiple growth vectors including ${extractedMetrics.growthDrivers.slice(0, 3).join(', ')}`;
  } else {
    growthOpportunity = 'Organic growth opportunities through market expansion and operational improvements';
  }
  
  // Market position
  let marketPosition = extractedMetrics.marketPosition || 'Established market participant';
  if (location) {
    marketPosition += ` with strong ${location} presence`;
  }
  
  // Calculate confidence
  let confidence = 0.6;
  if (extractedMetrics.strategicAssets?.length > 0) confidence += 0.1;
  if (extractedMetrics.competitiveAdvantages?.length > 0) confidence += 0.1;
  if (extractedMetrics.growthDrivers?.length > 0) confidence += 0.1;
  if (revenue > 0 && ebitda > 0) confidence += 0.1;
  
  return {
    overview,
    keyStrengths: keyStrengths.length > 0 ? keyStrengths : [
      'Established business operations',
      'Industry experience and expertise',
      'Market presence and customer relationships'
    ],
    growthOpportunity,
    marketPosition,
    competitiveAdvantages: extractedMetrics.competitiveAdvantages || [],
    investmentHighlights: investmentHighlights.length > 0 ? investmentHighlights : [
      'Stable revenue base',
      'Growth potential in expanding market'
    ],
    riskAssessment,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Map free-text location to standardized region
 */
export function mapToStandardizedLocation(location: string): StandardizedLocation {
  const lowerLocation = location.toLowerCase();
  
  // US regions
  if (/northeast|new england|new york|boston|philadelphia|washington dc|maine|vermont|new hampshire|massachusetts|rhode island|connecticut|new jersey|pennsylvania|delaware|maryland/i.test(lowerLocation)) {
    return 'Northeast US';
  }
  if (/southeast|south east|florida|georgia|carolina|virginia|tennessee|kentucky|alabama|mississippi|louisiana|arkansas/i.test(lowerLocation)) {
    return 'Southeast US';
  }
  if (/southwest|south west|texas|arizona|new mexico|nevada|utah|colorado/i.test(lowerLocation)) {
    return 'Southwest US';
  }
  if (/west coast|california|oregon|washington|seattle|san francisco|los angeles|portland/i.test(lowerLocation)) {
    return 'West Coast US';
  }
  if (/midwest|illinois|indiana|ohio|michigan|wisconsin|minnesota|iowa|missouri|kansas|nebraska|north dakota|south dakota/i.test(lowerLocation)) {
    return 'Midwest US';
  }
  if (/mountain|montana|wyoming|idaho/i.test(lowerLocation)) {
    return 'Mountain West US';
  }
  
  // Canada
  if (/ontario|quebec|atlantic|maritime|toronto|montreal|ottawa/i.test(lowerLocation)) {
    return 'Eastern Canada';
  }
  if (/alberta|british columbia|saskatchewan|manitoba|calgary|vancouver|edmonton/i.test(lowerLocation)) {
    return 'Western Canada';
  }
  
  // International
  if (/united kingdom|uk|england|scotland|wales|london|manchester|birmingham/i.test(lowerLocation)) {
    return 'United Kingdom';
  }
  if (/germany|france|netherlands|belgium|spain|italy|switzerland|austria|denmark|sweden|norway/i.test(lowerLocation)) {
    return 'Western Europe';
  }
  if (/poland|czech|hungary|romania|bulgaria|croatia|slovenia|slovakia/i.test(lowerLocation)) {
    return 'Eastern Europe';
  }
  if (/australia|new zealand|sydney|melbourne|auckland/i.test(lowerLocation)) {
    return 'Australia/New Zealand';
  }
  if (/asia|japan|china|singapore|hong kong|south korea|taiwan|india/i.test(lowerLocation)) {
    return 'Asia Pacific';
  }
  
  return 'International';
}

/**
 * Calculate investment metrics
 */
export function calculateInvestmentMetrics(revenue: number, ebitda: number) {
  return {
    ebitdaMargin: revenue > 0 ? ((ebitda / revenue) * 100).toFixed(1) : '0',
    revenueMultiple: ebitda > 0 ? (revenue / ebitda).toFixed(1) : '0',
    roiPotential: ebitda > 25000000 ? 'High' : ebitda > 10000000 ? 'Medium' : 'Conservative',
    scalabilityScore: revenue > 50000000 ? 95 : revenue > 20000000 ? 85 : revenue > 10000000 ? 75 : 65
  };
}
