
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
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
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
 * Validate if a currency string can be parsed
 */
export function isValidCurrency(value: string): boolean {
  const parsed = parseCurrency(value);
  return !isNaN(parsed) && parsed >= 0;
}
