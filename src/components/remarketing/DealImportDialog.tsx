import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  Check, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

// Import from unified import engine
import {
  type ColumnMapping,
  type ImportValidationError,
  type MergeStats,
  DEAL_IMPORT_FIELDS,
  normalizeHeader,
  processRow,
  mergeColumnMappings,
} from "@/lib/deal-csv-import";

interface DealImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

export function DealImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: DealImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingStats, setMappingStats] = useState<MergeStats | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingVersion, setMappingVersion] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [columnFilter, setColumnFilter] = useState("");

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: async (results) => {
        const data = results.data as Record<string, string>[];
        setCsvData(data);

        // Get column names
        // IMPORTANT: Use PapaParse meta.fields so we don't miss columns that are blank
        // in the first row (Object.keys(data[0]) can omit them).
        const columns = (results.meta.fields || [])
          .map((c) => (c ? normalizeHeader(c) : ""))
          .filter((c) => c.trim());
        
        // Log parsed columns for debugging
        console.log(`[DealImportDialog] Parsed ${columns.length} columns:`, columns);
        
        // Get sample data for context
        const sampleData = data.slice(0, 3);
        
        // Try AI mapping
        setIsMapping(true);
        setStep("mapping");
        
        try {
          const { data: mappingResult, error } = await supabase.functions.invoke(
            "map-csv-columns",
            {
              body: { 
                columns, 
                targetType: "deal",
                sampleData 
              },
            }
          );

          if (error) throw error;

          // Helps verify which backend deployment the UI is actually hitting
          setMappingVersion(mappingResult?._version ?? null);
          if (mappingResult?._version) {
            console.log("map-csv-columns version:", mappingResult._version);
          }

          // CRITICAL: Merge AI mappings with full column list
          // This ensures all parsed columns are visible even if AI returns partial list
          const [merged, stats] = mergeColumnMappings(columns, mappingResult?.mappings);
          
          console.log(`[DealImportDialog] Merge stats: AI returned ${stats.aiReturnedCount}, filled ${stats.filledCount}`);
          
          // Warn if AI returned incomplete mappings
          if (stats.filledCount > 0) {
            console.warn(
              `[DealImportDialog] AI mapping incomplete: ${stats.filledCount} columns were not mapped by AI`
            );
          }
          
          setColumnMappings(merged);
          setMappingStats(stats);
        } catch (error) {
          console.error("AI mapping failed:", error);
          // Fallback to empty mapping - still use merge to ensure all columns present
          const [merged, stats] = mergeColumnMappings(columns, []);
          setColumnMappings(merged);
          setMappingStats(stats);
        } finally {
          setIsMapping(false);
        }
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  }, []);

  const updateMapping = (csvColumn: string, targetField: string | null) => {
    setColumnMappings((prev) =>
      prev.map((m) =>
        m.csvColumn === csvColumn
          ? { ...m, targetField, aiSuggested: false }
          : m
      )
    );
  };

  const handleImport = async () => {
    setStep("importing");
    setIsImporting(true);
    setImportProgress(0);

    const results = { imported: 0, errors: [] as string[] };

    try {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        setImportProgress(Math.round(((i + 1) / csvData.length) * 100));

        try {
          // Use unified row processor
          const { data: parsedData, errors: rowErrors } = processRow(row, columnMappings, i + 2);
          
          // Collect validation errors
          if (rowErrors.length > 0) {
            rowErrors.forEach(err => {
              results.errors.push(`Row ${err.row}: ${err.message}`);
            });
          }
          
          // Skip if no valid data
          if (!parsedData) {
            continue;
          }

          // Build final listing object
          const listingData = {
            ...parsedData,
            is_active: true,
            status: 'active',
          };

          // Log what we're importing for debugging
          console.log(`Row ${i + 2} import data:`, {
            title: listingData.title,
            website: listingData.website,
            address_city: listingData.address_city,
            address_state: listingData.address_state,
            revenue: listingData.revenue,
            ebitda: listingData.ebitda,
          });

          // Insert the listing
          const { error: insertError } = await supabase
            .from("listings")
            .insert(listingData as never);

          if (insertError) throw insertError;

          results.imported++;
        } catch (error) {
          console.error(`Row ${i + 2} error:`, error);
          results.errors.push(`Row ${i + 2}: ${(error as Error).message}`);
        }
      }

      setImportResults(results);
      setStep("complete");
      
      if (results.imported > 0) {
        toast.success(`Successfully imported ${results.imported} deals`);
        onImportComplete();
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${(error as Error).message}`);
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setColumnMappings([]);
    setMappingStats(null);
    setImportProgress(0);
    setImportResults(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const getMappedFieldCount = () =>
    columnMappings.filter((m) => m.targetField).length;

  const filteredColumnMappings = columnMappings.filter((m) => {
    const q = columnFilter.trim().toLowerCase();
    if (!q) return true;
    return m.csvColumn.toLowerCase().includes(q);
  });

  const hasRequiredField = columnMappings.some(m => m.targetField === "title");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Deals from CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file with your deal data"}
            {step === "mapping" && "Review and confirm column mappings"}
            {step === "preview" && "Preview the data before importing"}
            {step === "importing" && "Importing deals..."}
            {step === "complete" && "Import complete"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="border-2 border-dashed rounded-lg p-12 text-center w-full max-w-md">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Upload CSV File</p>
                <p className="text-sm text-muted-foreground mb-4">
                  AI will automatically map your columns
                </p>
                <Label htmlFor="csv-upload" className="cursor-pointer">
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Select File
                    </span>
                  </Button>
                </Label>
              </div>
            </div>
          )}

          {/* Step: Column Mapping */}
          {step === "mapping" && (
            <div className="flex-1 flex flex-col min-h-0">
              {isMapping ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Sparkles className="h-8 w-8 mb-4 text-primary animate-pulse" />
                  <p className="font-medium">AI is analyzing your columns...</p>
                  <p className="text-sm text-muted-foreground">This will just take a moment</p>
                </div>
              ) : (
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
                                  updateMapping(
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
                    <Button variant="outline" onClick={reset}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep("preview")}
                      disabled={!hasRequiredField}
                    >
                      Preview Import
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="mb-4">
                <p className="font-medium">Ready to import {csvData.length} deals</p>
                <p className="text-sm text-muted-foreground">
                  Mapped fields: {columnMappings.filter((m) => m.targetField).map((m) => 
                    DEAL_IMPORT_FIELDS.find((f) => f.value === m.targetField)?.label
                  ).join(", ")}
                </p>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {columnMappings
                        .filter((m) => m.targetField)
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
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {columnMappings
                          .filter((m) => m.targetField)
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
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Mapping
                </Button>
                <Button onClick={handleImport}>
                  Import {csvData.length} Deals
                  <Check className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 mb-4 text-primary animate-spin" />
              <p className="font-medium">Importing deals...</p>
              <div className="w-full max-w-xs mt-4">
                <Progress value={importProgress} />
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {importProgress}% complete
                </p>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === "complete" && importResults && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center">
                <div className="mb-4">
                  {importResults.imported > 0 ? (
                    <Check className="h-12 w-12 mx-auto text-primary" />
                  ) : (
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  )}
                </div>
                <p className="font-medium text-lg">
                  {importResults.imported > 0
                    ? `Successfully imported ${importResults.imported} deals`
                    : "No deals were imported"}
                </p>
                {importResults.errors.length > 0 && (
                  <div className="mt-4 text-left max-w-md">
                    <p className="text-sm font-medium text-destructive mb-2">
                      {importResults.errors.length} error(s):
                    </p>
                    <ScrollArea className="h-32 border rounded p-2">
                      {importResults.errors.slice(0, 10).map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {err}
                        </p>
                      ))}
                      {importResults.errors.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          ...and {importResults.errors.length - 10} more errors
                        </p>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          {step === "complete" ? (
            <Button onClick={handleClose}>
              Close
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
