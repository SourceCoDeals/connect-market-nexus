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
 * Supports: domain.com, www.domain.com, sub.domain.com, domain.co.uk, https://domain.com
 */
export const isValidUrlFormat = (url: string | null | undefined): boolean => {
  if (!url || !url.trim()) {
    return true; // Empty is valid (optional field)
  }

  const trimmedUrl = url.trim();
  
  // Comprehensive URL pattern that accepts:
  // - domain.com, domain.co.uk (multi-part TLDs)
  // - www.domain.com
  // - sub.domain.com (subdomains)
  // - https://domain.com, http://domain.com
  // - Paths, query strings: domain.com/path?query=value
  const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
  
  return urlPattern.test(trimmedUrl);
};

/**
 * Validates if a LinkedIn URL is in a valid format
 * Accepts: linkedin.com/in/username, www.linkedin.com/company/name, https://linkedin.com/in/user
 */
export const isValidLinkedInFormat = (url: string | null | undefined): boolean => {
  if (!url || !url.trim()) {
    return true; // Empty is valid (optional field)
  }

  const trimmedUrl = url.trim();
  
  // LinkedIn URL pattern - accepts with or without protocol/www
  // Matches: linkedin.com/in/*, linkedin.com/company/*, etc.
  const linkedinPattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company|school|groups)\/[a-zA-Z0-9_-]+\/?.*$/i;
  
  return linkedinPattern.test(trimmedUrl);
};

/**
 * Processes a LinkedIn URL to ensure it has proper protocol
 */
export const processLinkedInUrl = (url: string | null | undefined): string => {
  if (!url || !url.trim()) {
    return '';
  }

  const trimmedUrl = url.trim();
  
  // If already has protocol, return as-is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // Add https:// prefix
  return `https://${trimmedUrl}`;
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
  
  // Handle database-formatted camelCase roles first (exact matches)
  if (normalizedRole === 'privateequity') return 'PE';
  if (normalizedRole === 'familyoffice') return 'FO';
  if (normalizedRole === 'searchfund') return 'SF';
  if (normalizedRole === 'independentsponsor') return 'IS';
  if (normalizedRole === 'corporate') return 'Corp';
  if (normalizedRole === 'individual') return 'Individual';
  
  // Tokenize to avoid false positives (e.g., 'independent' contains 'pe')
  const tokens = new Set((normalizedRole.match(/[a-z]+/g) || []));
  
  // Independent Sponsor - check FIRST before PE to prevent false matches
  if (normalizedRole.includes('independent sponsor') || 
      (tokens.has('independent') && tokens.has('sponsor'))) {
    return 'IS';
  }
  
  // Private Equity
  if (normalizedRole.includes('private equity') ||
      (tokens.has('private') && tokens.has('equity')) ||
      tokens.has('pe')) {
    return 'PE';
  }
  
  // Family Office
  if (normalizedRole.includes('family office') ||
      (tokens.has('family') && tokens.has('office')) ||
      tokens.has('fo')) {
    return 'FO';
  }
  
  // Search Fund
  if (normalizedRole.includes('search fund') ||
      (tokens.has('search') && tokens.has('fund')) ||
      tokens.has('sf')) {
    return 'SF';
  }
  
  // Corporate
  if (normalizedRole.includes('corporate') || tokens.has('corp')) {
    return 'Corp';
  }
  
  // Individual / Investor
  if (normalizedRole.includes('individual') || normalizedRole.includes('investor')) {
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
  
  // Handle database-formatted camelCase roles first (exact matches)
  if (normalizedRole === 'privateequity') {
    return { tier: 1, badge: '1', color: 'text-emerald-500', description: 'Private Equity' };
  }
  if (normalizedRole === 'familyoffice') {
    return { tier: 2, badge: '2', color: 'text-blue-600', description: 'Family Office' };
  }
  if (normalizedRole === 'independentsponsor') {
    return { tier: 3, badge: '3', color: 'text-purple-600', description: 'Independent Sponsor' };
  }
  if (normalizedRole === 'corporate') {
    return { tier: 3, badge: '3', color: 'text-amber-600', description: 'Corporate' };
  }
  if (normalizedRole === 'searchfund') {
    return { tier: 4, badge: '4', color: 'text-orange-600', description: 'Search Fund' };
  }
  if (normalizedRole === 'individual') {
    return { tier: 5, badge: '5', color: 'text-gray-600', description: 'Individual' };
  }
  
  const tokens = new Set((normalizedRole.match(/[a-z]+/g) || []));
  
  // Independent Sponsor - check FIRST before PE to prevent false matches
  if (normalizedRole.includes('independent sponsor') || 
      (tokens.has('independent') && tokens.has('sponsor'))) {
    return { tier: 3, badge: '3', color: 'text-purple-600', description: 'Independent Sponsor' };
  }
  
  // Private Equity
  if (normalizedRole.includes('private equity') || 
      (tokens.has('private') && tokens.has('equity')) ||
      tokens.has('pe')) {
    return { tier: 1, badge: '1', color: 'text-emerald-500', description: 'Private Equity' };
  }
  
  // Family Office
  if (normalizedRole.includes('family office') || 
      (tokens.has('family') && tokens.has('office')) ||
      tokens.has('fo')) {
    return { tier: 2, badge: '2', color: 'text-blue-600', description: 'Family Office' };
  }
  
  // Corporate
  if (normalizedRole.includes('corporate') || tokens.has('corp')) {
    return { tier: 3, badge: '3', color: 'text-amber-600', description: 'Corporate' };
  }
  
  // Search Fund
  if (normalizedRole.includes('search fund') || 
      (tokens.has('search') && tokens.has('fund')) ||
      tokens.has('sf')) {
    return { tier: 4, badge: '4', color: 'text-orange-600', description: 'Search Fund' };
  }
  
  // Individual / Investor
  if (normalizedRole.includes('individual') || normalizedRole.includes('investor')) {
    return { tier: 5, badge: '5', color: 'text-gray-600', description: 'Individual' };
  }
  
  return { tier: 5, badge: '5', color: 'text-muted-foreground', description: 'Other' };
};