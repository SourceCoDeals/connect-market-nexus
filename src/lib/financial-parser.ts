
/**
 * Utility functions for parsing financial data from business descriptions
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
}

export interface InvestmentThesis {
  overview: string;
  keyStrengths: string[];
  growthOpportunity: string;
  marketPosition: string;
}

/**
 * Extract financial metrics from description text
 */
export function extractFinancialMetrics(description: string): ExtractedFinancials {
  const metrics: ExtractedFinancials = {};
  
  // Revenue extraction patterns
  const revenuePatterns = [
    /\$(\d+(?:\.\d+)?)\s*M\+?\s*revenue/i,
    /revenue.*?\$(\d+(?:\.\d+)?)\s*M/i,
    /(\d+(?:\.\d+)?)\s*million.*revenue/i,
  ];
  
  for (const pattern of revenuePatterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1]) * 1000000;
      metrics.revenue = {
        value,
        display: `$${match[1]}M+`,
        confidence: 0.9
      };
      break;
    }
  }
  
  // EBITDA extraction patterns
  const ebitdaPatterns = [
    /\$(\d+(?:\.\d+)?)\s*M\+?\s*EBITDA/i,
    /EBITDA.*?\$(\d+(?:\.\d+)?)\s*M/i,
    /(\d+(?:\.\d+)?)\s*million.*EBITDA/i,
  ];
  
  for (const pattern of ebitdaPatterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1]) * 1000000;
      metrics.ebitda = {
        value,
        display: `$${match[1]}M+`,
        confidence: 0.9
      };
      break;
    }
  }
  
  // Margin extraction
  const marginPatterns = [
    /(\d+(?:\.\d+)?)\%\s*margin/i,
    /margin.*?(\d+(?:\.\d+)?)\%/i,
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
  
  // Revenue model detection
  if (description.toLowerCase().includes('recurring')) {
    metrics.revenueModel = 'Recurring Revenue Model';
  } else if (description.toLowerCase().includes('project-based')) {
    metrics.revenueModel = 'Project-Based Revenue';
  } else if (description.toLowerCase().includes('contract')) {
    metrics.revenueModel = 'Contract-Based Revenue';
  }
  
  // Market position keywords
  const positionKeywords = ['established', 'leading', 'dominant', 'market leader', 'regional leader'];
  for (const keyword of positionKeywords) {
    if (description.toLowerCase().includes(keyword)) {
      metrics.marketPosition = keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' Market Position';
      break;
    }
  }
  
  // Growth drivers extraction
  const growthKeywords = ['expansion', 'growing market', 'market consolidation', 'infrastructure investment'];
  metrics.growthDrivers = growthKeywords.filter(keyword => 
    description.toLowerCase().includes(keyword)
  );
  
  // Strategic assets extraction
  const assetKeywords = ['equipment', 'fleet', 'relationships', 'contracts', 'bonding', 'prequalification'];
  metrics.strategicAssets = assetKeywords.filter(keyword => 
    description.toLowerCase().includes(keyword)
  );
  
  return metrics;
}

/**
 * Parse investment thesis from description
 */
export function parseInvestmentThesis(description: string): InvestmentThesis {
  const lines = description.split('\n').filter(line => line.trim());
  
  // Find thesis section
  let thesisStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('investment thesis')) {
      thesisStart = i + 1;
      break;
    }
  }
  
  const overview = thesisStart > -1 && lines[thesisStart] ? lines[thesisStart] : lines[0] || '';
  
  // Extract key strengths from bullet points
  const keyStrengths: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
      keyStrengths.push(line.replace(/^[•\-]\s*/, '').trim());
    }
  }
  
  // Find growth opportunity section
  let growthOpportunity = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('growth') && lines[i].toLowerCase().includes('opportunity')) {
      growthOpportunity = lines[i + 1] || '';
      break;
    }
  }
  
  // Determine market position
  let marketPosition = 'Established Market Position';
  if (description.toLowerCase().includes('leading')) {
    marketPosition = 'Market Leading Position';
  } else if (description.toLowerCase().includes('regional')) {
    marketPosition = 'Strong Regional Position';
  }
  
  return {
    overview,
    keyStrengths: keyStrengths.slice(0, 4), // Limit to top 4
    growthOpportunity: growthOpportunity || 'Strategic growth opportunities in expanding market',
    marketPosition
  };
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
