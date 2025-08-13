/**
 * Smart URL processing utilities for flexible URL input handling
 */

export function processUrl(input: string): string {
  if (!input || input.trim() === '') return '';
  
  const trimmed = input.trim();
  
  // Already has protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Add https:// prefix to all other formats
  return `https://${trimmed}`;
}

export function isValidUrlFormat(input: string): boolean {
  if (!input || input.trim() === '') return true; // Allow empty
  
  try {
    const processed = processUrl(input);
    new URL(processed);
    return true;
  } catch {
    return false;
  }
}

export function formatUrlForDisplay(input: string): string {
  if (!input) return '';
  return processUrl(input);
}