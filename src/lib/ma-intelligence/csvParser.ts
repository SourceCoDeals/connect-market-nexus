/**
 * Shared CSV parsing utilities
 * Single source of truth for CSV parsing across the app
 */

/**
 * Parse a CSV string into headers and rows
 */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1)
    .map(parseCSVLine)
    .filter(row => row.some(cell => cell.trim()));

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      // Check for escaped quote (double quote)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }

  // Don't forget the last field
  fields.push(current.trim());

  return fields;
}

/**
 * Convert a row of values to an object using headers as keys
 */
export function rowToObject<T extends Record<string, string>>(
  headers: string[],
  row: string[],
  mapping: Record<string, string>
): Partial<T> {
  const obj: Record<string, string> = {};

  headers.forEach((header, index) => {
    const fieldKey = mapping[header];
    if (fieldKey && fieldKey !== 'skip' && row[index]) {
      const value = row[index].trim();
      if (value) {
        obj[fieldKey] = value;
      }
    }
  });

  return obj as Partial<T>;
}
