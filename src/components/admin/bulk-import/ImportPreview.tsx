/**
 * ImportPreview.tsx
 *
 * Preview table for parsed CSV data in the bulk deal import workflow.
 * Shows valid/invalid rows, validation errors, and row counts.
 *
 * Extracted from BulkDealImportDialog.tsx for maintainability.
 */
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ParsedDeal } from './CsvParser';

interface ImportPreviewProps {
  parsedDeals: ParsedDeal[];
}

export function ImportPreview({ parsedDeals }: ImportPreviewProps) {
  const validCount = parsedDeals.filter((d) => d.isValid).length;
  const invalidCount = parsedDeals.filter((d) => !d.isValid).length;

  return (
    <div className="space-y-4 flex-shrink-0">
      <div>
        <Label>Step 3: Preview & Validate</Label>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>{validCount} valid rows</span>
          </div>
          {invalidCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span>{invalidCount} invalid rows</span>
            </div>
          )}
        </div>
      </div>

      {/* Compact Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left w-12">Status</th>
                <th className="px-3 py-2 text-left w-16">Row</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Company</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left w-32">Role</th>
                <th className="px-3 py-2 text-left max-w-xs">Message</th>
              </tr>
            </thead>
            <tbody>
              {parsedDeals.map((deal) => (
                <tr
                  key={deal.csvRowNumber}
                  className={deal.isValid ? 'hover:bg-muted/50' : 'bg-destructive/10'}
                >
                  <td className="px-3 py-2">
                    {deal.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{deal.csvRowNumber}</td>
                  <td className="px-3 py-2 font-medium">{deal.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{deal.email}</td>
                  <td className="px-3 py-2">{deal.companyName || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {deal.phoneNumber || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant="outline" className="text-xs font-normal">
                      {deal.role || '—'}
                    </Badge>
                  </td>
                  <td
                    className="px-3 py-2 max-w-xs truncate text-muted-foreground"
                    title={deal.message}
                  >
                    {deal.message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show validation errors if any */}
      {invalidCount > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="text-sm font-medium text-destructive mb-2">
            {invalidCount} Invalid Row{invalidCount > 1 ? 's' : ''}
          </div>
          <div className="text-xs space-y-1 text-muted-foreground max-h-24 overflow-y-auto">
            {parsedDeals
              .filter((d) => !d.isValid)
              .map((deal) => (
                <div key={deal.csvRowNumber}>
                  Row {deal.csvRowNumber}: {deal.errors.join(', ')}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
