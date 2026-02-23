import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, ArrowRight } from "lucide-react";

import { type ColumnMapping, type MergeStats, DEAL_IMPORT_FIELDS } from "@/lib/deal-csv-import";

interface ColumnMappingStepProps {
  csvData: Record<string, string>[];
  columnMappings: ColumnMapping[];
  mappingStats: MergeStats | null;
  isMapping: boolean;
  onUpdateMapping: (csvColumn: string, targetField: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ColumnMappingStep({
  csvData,
  columnMappings,
  mappingStats,
  isMapping,
  onUpdateMapping,
  onBack,
  onNext,
}: ColumnMappingStepProps) {
  const [columnFilter, setColumnFilter] = useState("");

  const getMappedFieldCount = () =>
    columnMappings.filter((m) => m.targetField).length;

  const filteredColumnMappings = columnMappings.filter((m) => {
    const q = columnFilter.trim().toLowerCase();
    if (!q) return true;
    return m.csvColumn.toLowerCase().includes(q);
  });

  if (isMapping) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Sparkles className="h-8 w-8 mb-4 text-primary animate-pulse" />
        <p className="font-medium">AI is mapping columns...</p>
        <p className="text-sm text-muted-foreground">This will just take a moment</p>
      </div>
    );
  }

  return (
    <>
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
        </div>
        <p className="text-sm text-muted-foreground">
          Map CSV columns to deal fields
        </p>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <Input
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            placeholder='Search columns (e.g. "Website", "EBITDA")'
          />
        </div>
        <div className="text-sm text-muted-foreground shrink-0">
          Showing {filteredColumnMappings.length} of {columnMappings.length}
        </div>
        {columnFilter.trim() && (
          <Button variant="outline" onClick={() => setColumnFilter("")}>
            Clear
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CSV Column</TableHead>
              <TableHead>Sample Value</TableHead>
              <TableHead>Map To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredColumnMappings.map((mapping) => (
              <TableRow key={mapping.csvColumn}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mapping.csvColumn}</span>
                    {mapping.aiSuggested && mapping.targetField && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {csvData[0]?.[mapping.csvColumn] || "—"}
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
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!columnMappings.some((m) => m.targetField === "title")}
        >
          Preview Import
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </>
  );
}

