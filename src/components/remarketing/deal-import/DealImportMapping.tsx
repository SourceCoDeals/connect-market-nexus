/**
 * DealImportMapping.tsx
 *
 * Column mapping step for the deal spreadsheet import workflow.
 * Shows AI-suggested mappings, allows manual overrides, and
 * provides search/filter for large column sets.
 *
 * Extracted from DealImportDialog.tsx for maintainability.
 */
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sparkles, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import {
  type ColumnMapping,
  type MergeStats,
  DEAL_IMPORT_FIELDS,
} from '@/lib/deal-csv-import';

interface DealImportMappingProps {
  csvData: Record<string, string>[];
  columnMappings: ColumnMapping[];
  mappingStats: MergeStats | null;
  mappingVersion: string | null;
  columnFilter: string;
  onColumnFilterChange: (filter: string) => void;
  onUpdateMapping: (csvColumn: string, targetField: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DealImportMapping({
  csvData,
  columnMappings,
  mappingStats,
  mappingVersion,
  columnFilter,
  onColumnFilterChange,
  onUpdateMapping,
  onBack,
  onNext,
}: DealImportMappingProps) {
  const getMappedFieldCount = () =>
    columnMappings.filter((m) => m.targetField).length;

  const filteredColumnMappings = columnMappings.filter((m) => {
    const q = columnFilter.trim().toLowerCase();
    if (!q) return true;
    return m.csvColumn.toLowerCase().includes(q);
  });

  const hasRequiredField = columnMappings.some(m => m.targetField === "title");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{csvData.length} rows</Badge>
          {mappingStats && (
            <Badge variant="secondary">
              Parsed: {mappingStats.parsedCount} cols
            </Badge>
          )}
          {mappingStats && mappingStats.aiReturnedCount > 0 && (
            <Badge variant="secondary">
              AI: {mappingStats.aiReturnedCount}
            </Badge>
          )}
          {mappingStats && mappingStats.filledCount > 0 && (
            <Badge variant="secondary">
              Filled: {mappingStats.filledCount}
            </Badge>
          )}
          <Badge variant="outline">
            {getMappedFieldCount()}/{columnMappings.length} mapped
          </Badge>
          {mappingVersion && (
            <Badge variant="outline" className="font-mono text-xs">
              {mappingVersion}
            </Badge>
          )}
          {!hasRequiredField && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Company Name required
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Map CSV columns to deal fields
        </p>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <Input
            value={columnFilter}
            onChange={(e) => onColumnFilterChange(e.target.value)}
            placeholder='Search columns (e.g. "Website", "EBITDA")'
          />
        </div>
        <div className="text-sm text-muted-foreground shrink-0">
          Showing {filteredColumnMappings.length} of {columnMappings.length}
        </div>
        {columnFilter.trim() && (
          <Button variant="outline" onClick={() => onColumnFilterChange("")}>
            Clear
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">CSV Column</TableHead>
              <TableHead className="w-[250px]">Sample Value</TableHead>
              <TableHead className="w-[200px]">Map To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredColumnMappings.map((mapping) => (
              <TableRow key={mapping.csvColumn}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate max-w-[180px]">
                      {mapping.csvColumn}
                    </span>
                    {mapping.aiSuggested && mapping.targetField && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[250px]">
                  <span className="truncate block text-muted-foreground text-sm">
                    {csvData[0]?.[mapping.csvColumn]?.substring(0, 100) || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping.targetField || "none"}
                    onValueChange={(value) =>
                      onUpdateMapping(
                        mapping.csvColumn,
                        value === "none" ? null : value
                      )
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Don't import" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't import</SelectItem>
                      {DEAL_IMPORT_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                          {field.required && " *"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="pt-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!hasRequiredField}
        >
          Preview Import
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
