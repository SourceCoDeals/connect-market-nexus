
/**
 * Utility functions for handling currency formatting and parsing
 */

/**
 * Parse a currency string and return a number
 * Handles formats like: $1,500,000, 1500000, $1.5M, 1.5M, etc.
 */
export function parseCurrency(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  if (!value || typeof value !== 'string') {
    return 0;
  }

  // Remove all non-numeric characters except decimal points and letters (for M, K suffixes)
  let cleanValue = value.replace(/[$,\s]/g, '');
  
  // Handle suffixes (M for million, K for thousand)
  const multipliers: { [key: string]: number } = {
    'k': 1000,
    'K': 1000,
    'm': 1000000,
    'M': 1000000,
    'b': 1000000000,
    'B': 1000000000,
  };

  let multiplier = 1;
  const lastChar = cleanValue.slice(-1);
  
  if (multipliers[lastChar]) {
    multiplier = multipliers[lastChar];
    cleanValue = cleanValue.slice(0, -1);
  }

  // Parse the numeric value
  const numericValue = parseFloat(cleanValue);
  
  if (isNaN(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * multiplier);
}

/**
 * Format a number as currency with smart millions formatting
 */
export function formatCurrency(value: number): string {
  // For large values, show in millions format
  if (value >= 1000000) {
    const millions = value / 1000000;
    if (millions >= 1000) {
      // Show as billions for very large numbers
      const billions = millions / 1000;
      return `$${billions.toFixed(billions >= 10 ? 0 : 1)}B`;
    }
    return `$${millions.toFixed(millions >= 100 ? 0 : millions >= 10 ? 0 : 1)}M`;
  }
  
  // For smaller values, use standard formatting
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with commas (no currency symbol)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format investment size ranges that are typically in millions
 * Handles cases like "5-100" -> "$5M-$100M"
 */
export function formatInvestmentSize(value: string): string {
  if (!value || !value.trim()) {
    return 'Not specified';
  }

  // Check if it's a range (contains dash or hyphen)
  if (value.includes('-') || value.includes('–')) {
    const [min, max] = value.split(/[-–]/).map(part => part.trim());
    
    // Parse each part and assume millions if no suffix
    const minParsed = parseCurrency(min);
    const maxParsed = parseCurrency(max);
    
    // If values are small (likely missing M suffix), multiply by million
    const minValue = minParsed < 1000 ? minParsed * 1000000 : minParsed;
    const maxValue = maxParsed < 1000 ? maxParsed * 1000000 : maxParsed;
    
    return `${formatCurrency(minValue)}-${formatCurrency(maxValue)}`;
  }
  
  // Single value
  const parsed = parseCurrency(value);
  const finalValue = parsed < 1000 ? parsed * 1000000 : parsed;
  return formatCurrency(finalValue);
}

/**
 * Format revenue ranges with better readability in millions format
 */
export function formatRevenueRange(min?: string | number | null, max?: string | number | null): string {
  if (!min && !max) return 'Not specified';
  
  const formatSingleValue = (val: string | number | null | undefined): string => {
    if (!val) return 'Any';
    const numericValue = typeof val === 'number' ? val : parseFloat(val.toString().replace(/,/g, ''));
    if (isNaN(numericValue)) return 'Any';
    
    // If the value is 1,000,000 or more, it's likely already the full amount - convert to millions
    if (numericValue >= 1000000) {
      const millions = numericValue / 1000000;
      return `$${millions.toFixed(millions % 1 === 0 ? 0 : 1)}M`;
    }
    
    // If the value is less than 1000, assume it's in millions already
    if (numericValue < 1000) {
      return `$${numericValue.toFixed(numericValue % 1 === 0 ? 0 : 1)}M`;
    }
    
    // For values between 1000-999999, treat as thousands and convert to millions
    const millions = numericValue / 1000;
    return `$${millions.toFixed(millions % 1 === 0 ? 0 : 1)}M`;
  };
  
  const minFormatted = formatSingleValue(min);
  const maxFormatted = formatSingleValue(max);
  
  if (min && max) {
    return `${minFormatted} - ${maxFormatted}`;
  } else if (min) {
    return `${minFormatted}+`;
  } else if (max) {
    return `Up to ${maxFormatted}`;
  }
  
  return 'Not specified';
}

/**
 * Validate if a currency string can be parsed
 */
export function isValidCurrency(value: string): boolean {
  const parsed = parseCurrency(value);
  return !isNaN(parsed) && parsed >= 0;
}
