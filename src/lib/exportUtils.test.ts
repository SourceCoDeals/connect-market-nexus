import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { exportToCSV } from './exportUtils';

// Capture CSV content written into Blob
let capturedCsvContent = '';
const mockLink = {
  setAttribute: vi.fn(),
  click: vi.fn(),
  style: {} as Record<string, string>,
};

beforeEach(() => {
  vi.restoreAllMocks();
  capturedCsvContent = '';
  mockLink.setAttribute.mockReset();
  mockLink.click.mockReset();

  // Mock Blob as a class (it is used with `new`)
  globalThis.Blob = class MockBlob {
    content: string[];
    type: string;
    constructor(content: string[], options?: { type?: string }) {
      this.content = content;
      this.type = options?.type || '';
      capturedCsvContent = content[0];
    }
  } as unknown as typeof Blob;

  // Mock URL APIs
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();

  // Mock document DOM methods
  vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as HTMLElement);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as HTMLElement);
});

describe('exportToCSV', () => {
  it('does nothing when data array is empty', () => {
    exportToCSV([], 'test');
    expect(capturedCsvContent).toBe('');
  });

  it('creates a CSV with correct headers from column definitions', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const columns = [
      { key: 'name' as const, label: 'Full Name' },
      { key: 'age' as const, label: 'Age' },
    ];

    exportToCSV(data, 'test-export', columns);

    expect(capturedCsvContent).toContain('"Full Name","Age"');
    expect(capturedCsvContent).toContain('"Alice",30');
    expect(capturedCsvContent).toContain('"Bob",25');
  });

  it('auto-generates headers from object keys when columns not provided', () => {
    const data = [{ first_name: 'Alice', email_verified: true }];

    exportToCSV(data, 'auto-headers');

    // formatHeader converts "first_name" -> "First Name"
    expect(capturedCsvContent).toContain('"First Name"');
    expect(capturedCsvContent).toContain('"Email Verified"');
  });

  it('escapes double quotes in string values', () => {
    const data = [{ note: 'She said "hello"' }];
    const columns = [{ key: 'note' as const, label: 'Note' }];

    exportToCSV(data, 'escaped', columns);

    // CSV escaping: double quotes become ""
    expect(capturedCsvContent).toContain('"She said ""hello"""');
  });

  it('handles null and undefined values as empty quoted strings', () => {
    const data = [{ a: null, b: undefined }];
    const columns = [
      { key: 'a' as const, label: 'A' },
      { key: 'b' as const, label: 'B' },
    ];

    exportToCSV(data, 'nulls', columns);

    const lines = capturedCsvContent.split('\n');
    expect(lines[1]).toBe('"",""');
  });

  it('handles number values without quotes', () => {
    const data = [{ count: 42, price: 9.99 }];
    const columns = [
      { key: 'count' as const, label: 'Count' },
      { key: 'price' as const, label: 'Price' },
    ];

    exportToCSV(data, 'numbers', columns);

    const lines = capturedCsvContent.split('\n');
    expect(lines[1]).toBe('42,9.99');
  });

  it('triggers file download with correct filename', () => {
    const data = [{ x: 1 }];
    const columns = [{ key: 'x' as const, label: 'X' }];

    exportToCSV(data, 'my-export', columns);

    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'my-export.csv');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('handles multiple rows correctly', () => {
    const data = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ];
    const columns = [
      { key: 'id' as const, label: 'ID' },
      { key: 'name' as const, label: 'Name' },
    ];

    exportToCSV(data, 'multi-row', columns);

    const lines = capturedCsvContent.split('\n');
    expect(lines).toHaveLength(4); // 1 header + 3 data rows
  });

  it('converts boolean values to quoted strings', () => {
    const data = [{ active: true, deleted: false }];
    const columns = [
      { key: 'active' as const, label: 'Active' },
      { key: 'deleted' as const, label: 'Deleted' },
    ];

    exportToCSV(data, 'booleans', columns);

    const lines = capturedCsvContent.split('\n');
    expect(lines[1]).toBe('"true","false"');
  });

  it('formats camelCase header keys properly', () => {
    const data = [{ firstName: 'Test', lastUpdatedAt: '2024' }];

    exportToCSV(data, 'camel-headers');

    // formatHeader: "firstName" -> "First Name", "lastUpdatedAt" -> "Last Updated At"
    expect(capturedCsvContent).toContain('"First Name"');
    expect(capturedCsvContent).toContain('"Last Updated At"');
  });
});
