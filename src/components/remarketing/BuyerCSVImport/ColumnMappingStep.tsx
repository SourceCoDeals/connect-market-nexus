/**
 * ColumnMappingStep.tsx
 *
 * Wizard step 2: shows the AI-suggested (or heuristic) column mappings in a
 * table. The user can override each mapping via a <Select> dropdown.
 */
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

import { CSVRow, ColumnMapping, TARGET_FIELDS, hasRequiredMapping } from './helpers';

interface ColumnMappingStepProps {
  mappings: ColumnMapping[];
  csvData: CSVRow[];
  isAnalyzing: boolean;
  onUpdateMapping: (csvColumn: string, targetField: string | null) => void;
}

export function ColumnMappingStep({
  mappings,
  csvData,
  isAnalyzing,
  onUpdateMapping,
}: ColumnMappingStepProps) {
  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>AI is analyzing your columns...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        AI has suggested mappings. Review and adjust as needed.
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CSV Column</TableHead>
            <TableHead>Map To</TableHead>
            <TableHead>Sample Data</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => (
            <TableRow key={mapping.csvColumn}>
              <TableCell className="font-medium">{mapping.csvColumn}</TableCell>
              <TableCell>
                <Select
                  value={mapping.targetField || 'skip'}
                  onValueChange={(value) =>
                    onUpdateMapping(mapping.csvColumn, value === 'skip' ? null : value)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip this column</SelectItem>
                    {TARGET_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label} {field.required && '*'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs truncate max-w-[150px]">
                {csvData[0]?.[mapping.csvColumn] || '\u2014'}
              </TableCell>
              <TableCell>
                {mapping.targetField ? (
                  <Badge
                    variant={mapping.aiSuggested ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {mapping.aiSuggested ? 'AI' : 'Set'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Skip
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!hasRequiredMapping(mappings) && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          Company Name mapping is required
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {csvData.length} rows found in CSV
      </div>
    </div>
  );
}
