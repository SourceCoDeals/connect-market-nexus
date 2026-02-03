/**
 * Utility functions for deal CSV import
 */

export interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

export interface MergeStats {
  total: number;
  merged: number;
  new: number;
}

export const DEAL_IMPORT_FIELDS = [
  { value: "title", label: "Company Name" },
  { value: "website", label: "Website" },
  { value: "location", label: "Location (Marketplace)" },
  { value: "revenue", label: "Revenue" },
  { value: "ebitda", label: "EBITDA" },
  { value: "description", label: "Description" },
  { value: "geographic_states", label: "States" },
  { value: "services", label: "Services" },
  { value: "notes", label: "Notes" },
  { value: "street_address", label: "Street Address" },
  { value: "address_city", label: "City" },
  { value: "address_state", label: "State (2-letter)" },
  { value: "address_zip", label: "ZIP Code" },
  { value: "address_country", label: "Country" },
];

/**
 * Normalize CSV header names
 */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * Process a single CSV row
 */
export function processRow(row: Record<string, string>, mappings: ColumnMapping[]): Record<string, any> {
  const result: Record<string, any> = {};

  mappings.forEach((mapping) => {
    if (mapping.targetField && row[mapping.csvColumn]) {
      const value = row[mapping.csvColumn].trim();

      if (mapping.targetField === "revenue" || mapping.targetField === "ebitda") {
        const numValue = parseFloat(value.replace(/[$,]/g, ""));
        if (!isNaN(numValue)) {
          result[mapping.targetField] = numValue;
        }
      } else if (mapping.targetField === "geographic_states" || mapping.targetField === "services") {
        result[mapping.targetField] = value.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
      } else {
        result[mapping.targetField] = value;
      }
    }
  });

  return result;
}

/**
 * Merge column mappings
 */
export function mergeColumnMappings(
  existing: ColumnMapping[],
  suggested: ColumnMapping[]
): { mappings: ColumnMapping[]; stats: MergeStats } {
  const stats: MergeStats = {
    total: suggested.length,
    merged: 0,
    new: 0,
  };

  const mappings = suggested.map((sugg) => {
    const existing_match = existing.find((e) => e.csvColumn === sugg.csvColumn);
    if (existing_match) {
      stats.merged++;
      return existing_match;
    }
    stats.new++;
    return sugg;
  });

  return { mappings, stats };
}

/**
 * Sanitize listing data before insert to ensure all required fields are valid
 * and prevent database NOT NULL constraint violations
 */
export function sanitizeListingInsert(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };

  // CRITICAL: Ensure required NOT NULL fields have valid values

  // title: required string
  if (typeof sanitized.title !== 'string' || !sanitized.title.trim()) {
    throw new Error('title is required');
  }

  // description: required string, default to title if missing
  if (typeof sanitized.description !== 'string' || !sanitized.description.trim()) {
    sanitized.description = sanitized.title || "";
  }

  // revenue: required number, default to 0
  if (typeof sanitized.revenue !== 'number' || isNaN(sanitized.revenue)) {
    sanitized.revenue = 0;
  }

  // ebitda: required number, default to 0
  if (typeof sanitized.ebitda !== 'number' || isNaN(sanitized.ebitda)) {
    sanitized.ebitda = 0;
  }

  // location: required string, construct from city/state or default to "Unknown"
  if (typeof sanitized.location !== 'string' || !sanitized.location.trim()) {
    const city = typeof sanitized.address_city === 'string' ? sanitized.address_city.trim() : '';
    const state = typeof sanitized.address_state === 'string' ? sanitized.address_state.trim() : '';

    if (city && state) {
      sanitized.location = `${city}, ${state}`;
    } else if (city) {
      sanitized.location = city;
    } else if (state) {
      sanitized.location = state;
    } else {
      sanitized.location = 'Unknown';
    }
  }

  // category: required string, default to "Other"
  if (typeof sanitized.category !== 'string' || !sanitized.category.trim()) {
    sanitized.category = 'Other';
  }

  // status: default to "active" if not set
  if (!sanitized.status) {
    sanitized.status = 'active';
  }

  // is_active: default to true if not set
  if (typeof sanitized.is_active !== 'boolean') {
    sanitized.is_active = true;
  }

  // Clean up undefined/null values for optional fields
  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key];
    }
  });

  return sanitized;
}
