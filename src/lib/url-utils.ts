/**
 * URL processing utilities for flexible URL input handling
 */

/**
 * Processes a URL input to ensure it has a proper protocol
 * Handles: www.example.com, example.com, https://example.com
 * Always returns a valid URL with https:// prefix if protocol is missing
 */
export const processUrl = (url: string | null | undefined): string => {
  if (!url || !url.trim()) {
    return '';
  }

  const trimmedUrl = url.trim();
  
  // If already has protocol, return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // Add https:// prefix for www. or domain formats
  return `https://${trimmedUrl}`;
};

/**
 * Validates if a URL is in a valid format (with or without protocol)
 */
export const isValidUrlFormat = (url: string | null | undefined): boolean => {
  if (!url || !url.trim()) {
    return true; // Empty is valid (optional field)
  }

  const trimmedUrl = url.trim();
  
  // Basic URL pattern that accepts:
  // - www.domain.com
  // - domain.com
  // - https://domain.com
  // - http://domain.com
  const urlPattern = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/;
  
  return urlPattern.test(trimmedUrl);
};

/**
 * Gets display text for URL inputs to show users what will be saved
 */
export const getUrlDisplayText = (url: string | null | undefined): string => {
  if (!url || !url.trim()) {
    return '';
  }

  const processed = processUrl(url);
  return processed;
};

/**
 * Extracts domain from email address and creates a company website URL
 */
export const extractDomainFromEmail = (email: string | null | undefined): string => {
  if (!email || !email.trim()) {
    return '';
  }

  const emailParts = email.trim().split('@');
  if (emailParts.length !== 2) {
    return '';
  }

  const domain = emailParts[1].toLowerCase();
  return processUrl(domain);
};

/**
 * Maps common role names to buyer type abbreviations
 * Handles both display names (e.g., "Private Equity") and database values (e.g., "privateEquity")
 */
export const mapRoleToBuyerType = (role: string | null | undefined): string => {
  if (!role || !role.trim()) {
    return 'Buyer';
  }

  const normalizedRole = role.toLowerCase().trim();
  
  // Handle database format (e.g., "privateEquity")
  if (normalizedRole === 'privateequity' || normalizedRole.includes('private equity') || normalizedRole.includes('pe') || normalizedRole === 'pe') {
    return 'PE';
  }
  if (normalizedRole === 'familyoffice' || normalizedRole.includes('family office') || normalizedRole.includes('fo') || normalizedRole === 'fo') {
    return 'FO';
  }
  if (normalizedRole === 'searchfund' || normalizedRole.includes('search fund') || normalizedRole.includes('sf') || normalizedRole === 'sf') {
    return 'SF';
  }
  if (normalizedRole === 'corporate' || normalizedRole.includes('corporate') || normalizedRole.includes('corp')) {
    return 'Corp';
  }
  if (normalizedRole === 'independentsponsor' || normalizedRole.includes('independent sponsor') || normalizedRole.includes('is') || normalizedRole === 'independent sponsor') {
    return 'IS';
  }
  if (normalizedRole === 'individual' || normalizedRole.includes('individual') || normalizedRole.includes('investor')) {
    return 'Individual';
  }
  
  return 'Buyer';
};

/**
 * Get tier information for lead-only requests based on role
 */
export const getLeadTierInfo = (role: string | null | undefined) => {
  if (!role || !role.trim()) {
    return { tier: 5, badge: '5', color: 'text-muted-foreground', description: 'No type specified' };
  }

  const normalizedRole = role.toLowerCase().trim();
  
  if (normalizedRole.includes('private equity') || normalizedRole.includes('pe') || normalizedRole === 'pe') {
    return { tier: 1, badge: '1', color: 'text-emerald-500', description: 'Private Equity' };
  }
  if (normalizedRole.includes('family office') || normalizedRole.includes('fo') || normalizedRole === 'fo') {
    return { tier: 2, badge: '2', color: 'text-blue-600', description: 'Family Office' };
  }
  if (normalizedRole.includes('independent sponsor') || normalizedRole.includes('is') || normalizedRole === 'independent sponsor') {
    return { tier: 3, badge: '3', color: 'text-purple-600', description: 'Independent Sponsor' };
  }
  if (normalizedRole.includes('corporate') || normalizedRole.includes('corp')) {
    return { tier: 3, badge: '3', color: 'text-amber-600', description: 'Corporate' };
  }
  if (normalizedRole.includes('search fund') || normalizedRole.includes('sf') || normalizedRole === 'sf') {
    return { tier: 4, badge: '4', color: 'text-orange-600', description: 'Search Fund' };
  }
  if (normalizedRole.includes('individual') || normalizedRole.includes('investor')) {
    return { tier: 5, badge: '5', color: 'text-gray-600', description: 'Individual' };
  }
  
  return { tier: 5, badge: '5', color: 'text-muted-foreground', description: 'Other' };
};