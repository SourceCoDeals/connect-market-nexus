/**
 * Process a single CSV row into a validated deal object
 */

import type { ColumnMapping, ParsedDealData, ImportValidationError } from './types';
import { NUMERIC_FIELDS, INTEGER_FIELDS, ARRAY_FIELDS } from './constants';
import {
  normalizeHeader,
  parseNumericValue,
  parseIntegerValue,
  parseArrayValue,
  normalizeStateCode,
  extractAddressComponents,
  parseDateValue,
} from './parsers';

interface ProcessRowResult {
  data: ParsedDealData | null;
  errors: ImportValidationError[];
}

/**
 * Get cell value from row, handling header normalization
 */
function getCellValue(row: Record<string, string>, column: string): string | undefined {
  // Try direct access
  let value = row[column];
  
  // Try normalized header access
  if (value === undefined) {
    const normalizedColumn = normalizeHeader(column);
    value = row[normalizedColumn];
    
    // Try finding by trimmed key
    if (value === undefined) {
      const rowKeys = Object.keys(row);
      const matchingKey = rowKeys.find(k => normalizeHeader(k) === normalizedColumn);
      if (matchingKey) {
        value = row[matchingKey];
      }
    }
  }
  
  return value;
}

/**
 * Process a single CSV row into deal data
 */
export function processRow(
  row: Record<string, string>,
  mappings: ColumnMapping[],
  rowIndex: number
): ProcessRowResult {
  const errors: ImportValidationError[] = [];
  const data: Record<string, unknown> = {};
  
  // Track first/last name separately
  let firstName = '';
  let lastName = '';
  
  // Process each mapping
  for (const mapping of mappings) {
    if (!mapping.targetField) continue;
    
    const rawValue = getCellValue(row, mapping.csvColumn);
    if (!rawValue) continue;
    
    const value = String(rawValue).trim();
    const lower = value.toLowerCase();
    // Treat common sentinel strings as empty cells (prevents inserting "undefined"/"null")
    if (!value || value === '-' || lower === 'n/a' || lower === 'undefined' || lower === 'null') continue;
    
    const field = mapping.targetField;
    
    try {
      // Numeric fields (float)
      if (NUMERIC_FIELDS.includes(field)) {
        const parsed = parseNumericValue(value);
        if (parsed !== null) {
          data[field] = parsed;
        }
      }
      // Integer fields
      else if (INTEGER_FIELDS.includes(field)) {
        const parsed = parseIntegerValue(value);
        if (parsed !== null) {
          data[field] = parsed;
        }
      }
      // Array fields
      else if (ARRAY_FIELDS.includes(field)) {
        data[field] = parseArrayValue(value);
      }
      // Full address - extract components
      else if (field === 'address') {
        data.address = value;
        
        // Extract city/state/zip from address if not already set
        const extracted = extractAddressComponents(value);
        if (extracted.city && !data.address_city) {
          data.address_city = extracted.city;
        }
        if (extracted.state && !data.address_state) {
          data.address_state = extracted.state;
        }
        if (extracted.zip && !data.address_zip) {
          data.address_zip = extracted.zip;
        }
      }
      // State code
      else if (field === 'address_state') {
        const normalized = normalizeStateCode(value);
        if (normalized) {
          data.address_state = normalized;
        }
      }
      // First name (combine later)
      else if (field === 'primary_contact_first_name') {
        firstName = value;
      }
      // Last name (combine later)
      else if (field === 'primary_contact_last_name') {
        lastName = value;
      }
      // String fields (default)
      else {
        data[field] = value;
      }
    } catch (error) {
      errors.push({
        row: rowIndex,
        field,
        message: `Failed to parse value: ${(error as Error).message}`,
        value,
      });
    }
  }
  
  // Combine first + last name
  if (firstName || lastName) {
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName && !data.primary_contact_name) {
      data.primary_contact_name = fullName;
    }
  }
  
  // Validate required fields
  if (!data.title) {
    errors.push({
      row: rowIndex,
      field: 'title',
      message: 'Missing required field: Company Name',
    });
    return { data: null, errors };
  }
  
  // Set defaults
  if (!data.category) {
    data.category = 'Other';
  }
  if (!data.address_country && (data.address_city || data.address_state)) {
    data.address_country = 'US';
  }
  
  return { data: data as unknown as ParsedDealData, errors };
}
