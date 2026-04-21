/**
 * Unified spreadsheet parser that supports CSV, XLS, and XLSX file formats.
 *
 * All import dialogs should use this utility instead of calling PapaParse directly
 * so that Excel file formats are handled transparently.
 *
 * ExcelJS is loaded on-demand to avoid adding it to the initial bundle.
 * (Swapped in for SheetJS/xlsx during the 2026-04-20 platform audit —
 * SheetJS shipped two unpatched high-severity vulns with no fix available,
 * ExcelJS is actively maintained with no known vulns in the current major.)
 */
import Papa from 'papaparse';

/** Accepted file extensions for spreadsheet imports */
export const SPREADSHEET_ACCEPT = '.csv,.xls,.xlsx';

/**
 * Determine whether a file is an Excel format (XLS/XLSX) based on its extension.
 */
function isExcelFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'xls' || ext === 'xlsx';
}

/** Lazy-load exceljs only when an Excel file is actually encountered */
async function getExcelJS() {
  const mod = await import('exceljs');
  // exceljs exports `default` as the ExcelJS namespace in ESM builds.
  return mod.default ?? mod;
}

/**
 * Convert an exceljs cell value to the string shape the CSV consumers expect.
 * ExcelJS returns: primitives, Date, { richText: [...] }, { formula, result },
 * { hyperlink, text }, or an error cell. We flatten all of these to a plain
 * string (matching how PapaParse returns string data for CSVs).
 */
function cellValueToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // Rich text cell: { richText: [{ text: 'a' }, { text: 'b' }, ...] }
    if (Array.isArray(v.richText)) {
      return v.richText.map((r) => (r as { text?: string }).text ?? '').join('');
    }
    // Hyperlink cell: { text: 'label', hyperlink: 'https://...' } — prefer text
    if (typeof v.text === 'string') return v.text;
    // Formula cell: { formula, result } — use the computed result
    if ('result' in v) return cellValueToString(v.result);
    // Error cell: { error: '#REF!' } — expose the error token
    if (typeof v.error === 'string') return v.error;
  }
  return String(value);
}

/**
 * Parse an XLS or XLSX file into an array of row objects.
 * Uses the first sheet in the workbook. All values are coerced to strings
 * so downstream code (which was written for CSV string data) works unchanged.
 */
async function parseExcelFile(file: File): Promise<{
  data: Record<string, string>[];
  columns: string[];
}> {
  const ExcelJS = await getExcelJS();
  const buffer = await file.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('The uploaded workbook has no sheets');
  }

  // Header row = row 1. getRow().values returns a 1-indexed sparse array;
  // slice(1) drops the leading undefined.
  const headerRow = sheet.getRow(1).values as unknown[];
  const columns: string[] = (Array.isArray(headerRow) ? headerRow.slice(1) : [])
    .map((v) => cellValueToString(v))
    .map((v) => v.trim())
    .filter((v) => v !== '');

  if (columns.length === 0) {
    return { data: [], columns: [] };
  }

  const data: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const values = row.values as unknown[];
    const cells = Array.isArray(values) ? values.slice(1) : [];

    const obj: Record<string, string> = {};
    columns.forEach((col, idx) => {
      obj[col] = cellValueToString(cells[idx]);
    });
    data.push(obj);
  });

  return { data, columns };
}

export interface ParsedSpreadsheet {
  /** Array of row objects keyed by header name */
  data: Record<string, string>[];
  /** Ordered list of column headers detected in the file */
  columns: string[];
}

/**
 * Parse a spreadsheet file (CSV, XLS, or XLSX) into a common format.
 *
 * For CSV files, PapaParse is used (preserving existing behaviour).
 * For XLS/XLSX files, ExcelJS converts the first sheet into the same shape.
 *
 * @param file          The File object from an <input type="file"> element.
 * @param normalizeHdr  Optional header-normalisation function (e.g. strip BOM + trim).
 *                      Applied to every column name before returning.
 */
export async function parseSpreadsheet(
  file: File,
  normalizeHdr?: (header: string) => string,
): Promise<ParsedSpreadsheet> {
  if (isExcelFile(file)) {
    const { data, columns } = await parseExcelFile(file);

    if (normalizeHdr) {
      // Re-key every row and the column list through the normaliser
      const normColumns = columns.map(normalizeHdr);
      const normData = data.map((row) => {
        const out: Record<string, string> = {};
        columns.forEach((col, idx) => {
          out[normColumns[idx]] = row[col];
        });
        return out;
      });
      return { data: normData, columns: normColumns };
    }

    return { data, columns };
  }

  // ---- CSV path (uses PapaParse, matching existing behaviour) ----
  return new Promise<ParsedSpreadsheet>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHdr,
      complete: (results) => {
        const data = results.data as Record<string, string>[];

        // Prefer PapaParse meta.fields; fall back to first-row keys
        const metaColumns = (results.meta.fields || []).filter((c) => c && c.trim());
        const fallbackColumns = Object.keys(data?.[0] || {}).filter((c) => c && c.trim());
        const columns = metaColumns.length > 0 ? metaColumns : fallbackColumns;

        resolve({ data, columns });
      },
      error: (err: Error) => {
        reject(new Error(`Failed to parse CSV: ${err.message}`));
      },
    });
  });
}

/**
 * Escape a cell value for CSV output. Wraps in quotes and doubles any
 * embedded quotes if the value contains a comma, quote, or newline.
 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a spreadsheet file into a raw CSV-like text string.
 * This is specifically for the BulkDealImportDialog which feeds the text into
 * its own PapaParse-based `parseCSV()` method.
 *
 * For CSV files this simply reads the file as text.
 * For XLS/XLSX files it converts the first sheet to a CSV string.
 */
export async function readSpreadsheetAsText(file: File): Promise<string> {
  if (isExcelFile(file)) {
    const ExcelJS = await getExcelJS();
    const buffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('The uploaded workbook has no sheets');
    }

    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as unknown[];
      const cells = Array.isArray(values) ? values.slice(1) : [];
      lines.push(cells.map((v) => csvEscape(cellValueToString(v))).join(','));
    });
    return lines.join('\n');
  }

  // CSV — read as text (existing behaviour)
  return file.text();
}
