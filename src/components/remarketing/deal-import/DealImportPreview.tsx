/**
 * DealImportPreview.tsx
 *
 * Preview step for the deal spreadsheet import workflow.
 * Shows mapped columns and sample data before import.
 *
 * Extracted from DealImportDialog.tsx for maintainability.
 */
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Check } from 'lucide-react';
import {
  type ColumnMapping,
  DEAL_IMPORT_FIELDS,
} from '@/lib/deal-csv-import';

interface DealImportPreviewProps {
  csvData: Record<string, string>[];
  columnMappings: ColumnMapping[];
  onBack: () => void;
  onImport: () => void;
}

export function DealImportPreview({
  csvData,
  columnMappings,
  onBack,
  onImport,
}: DealImportPreviewProps) {
  const mappedColumns = columnMappings.filter((m) => m.targetField);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-4">
        <p className="font-medium">Ready to import {csvData.length} deals</p>
        <p className="text-sm text-muted-foreground">
          Mapped fields: {mappedColumns.map((m) =>
            DEAL_IMPORT_FIELDS.find((f) => f.value === m.targetField)?.label
          ).join(", ")}
        </p>
      </div>

      <ScrollArea className="flex-1 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              {mappedColumns
                .slice(0, 6)
                .map((m) => (
                  <TableHead key={m.csvColumn}>
                    {DEAL_IMPORT_FIELDS.find((f) => f.value === m.targetField)?.label}
                  </TableHead>
                ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {csvData.slice(0, 10).map((row, i) => (
              <TableRow key={`row-${i}`}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                {mappedColumns
                  .slice(0, 6)
                  .map((m) => (
                    <TableCell key={m.csvColumn} className="max-w-[150px] truncate">
                      {row[m.csvColumn]?.substring(0, 50) || "—"}
                    </TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {csvData.length > 10 && (
        <p className="text-sm text-muted-foreground mt-2">
          Showing first 10 of {csvData.length} rows
        </p>
      )}

      <div className="pt-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Mapping
        </Button>
        <Button onClick={onImport}>
          Import {csvData.length} Deals
          <Check className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
