import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  Check, 
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

// Import from unified import engine
import {
  type ColumnMapping,
  type MergeStats,
  DEAL_IMPORT_FIELDS,
  normalizeHeader,
  processRow,
  mergeColumnMappings,
} from "@/lib/deal-csv-import";

export interface DealCSVImportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  universeId: string;
  universeName?: string;
  onImportComplete?: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

export const DealCSVImport = ({
  universeId,
  universeName,
  onImportComplete,
}: DealCSVImportProps) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [mappingStats, setMappingStats] = useState<MergeStats | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [columnFilter, setColumnFilter] = useState("");
  const [importResults, setImportResults] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      // Normalize headers (strip BOM + trim) so mapping + row access works reliably
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
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
        console.log(`[DealCSVImport] Parsed ${columns.length} columns:`, columns);
        
        // Try AI mapping
        setIsMapping(true);
        try {
          const { data: mappingResult, error } = await supabase.functions.invoke(
            "map-csv-columns",
            {
              // Pass a few sample rows to improve mapping quality (disambiguates similar headers)
              body: { columns, targetType: "deal", sampleData: data.slice(0, 3) },
            }
          );

          if (error) throw error;

          // CRITICAL: Merge AI mappings with full column list
          // This ensures all parsed columns are visible even if AI returns partial list
          const [merged, stats] = mergeColumnMappings(columns, mappingResult?.mappings);
          
          console.log(`[DealCSVImport] Merge stats: AI returned ${stats.aiReturnedCount}, filled ${stats.filledCount}`);
          
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
          setStep("mapping");
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const results = { imported: 0, errors: [] as string[] };

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        setImportProgress(Math.round(((i + 1) / csvData.length) * 100));

        try {
          // Build listing object dynamically - use Record to support all mapped fields
          const listingData: Record<string, unknown> = {
            is_active: true,
            category: "Other",
          };

          // Numeric fields that need parsing
          const numericFields = ["revenue", "ebitda", "full_time_employees", "number_of_locations", "google_review_count", "google_review_score"];
          // Array fields that need splitting
          const arrayFields = ["geographic_states", "services"];

          columnMappings.forEach((mapping) => {
            if (!mapping.targetField) return;
            
            // Get the value - handle potential whitespace in column names
            const csvColumn = mapping.csvColumn;
            let value = row[csvColumn];
            
            // If direct access fails, try finding by trimmed key
            if (value === undefined) {
              const rowKeys = Object.keys(row);
              const matchingKey = rowKeys.find(k => k.trim() === csvColumn.trim());
              if (matchingKey) {
                value = row[matchingKey];
              }
            }
            
            if (!value || typeof value !== 'string') return;
            
            const trimmedValue = value.trim();
            if (!trimmedValue) return;
            
            console.log(`Mapping: ${csvColumn} -> ${mapping.targetField} = "${trimmedValue}"`);
            
            if (numericFields.includes(mapping.targetField)) {
              // Parse numeric values (remove $, commas, M/K suffixes, etc.)
              let numStr = trimmedValue.replace(/[$,]/g, "");
              let multiplier = 1;
              if (numStr.toUpperCase().endsWith('M')) {
                multiplier = 1000000;
                numStr = numStr.slice(0, -1);
              } else if (numStr.toUpperCase().endsWith('K')) {
                multiplier = 1000;
                numStr = numStr.slice(0, -1);
              }
              const numValue = parseFloat(numStr) * multiplier;
              if (!isNaN(numValue)) {
                listingData[mapping.targetField] = numValue;
              }
            } else if (arrayFields.includes(mapping.targetField)) {
              // Parse as array
              listingData[mapping.targetField] = trimmedValue.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
            } else if (mapping.targetField === "address") {
              // Full address field - parse out street, city, state, zip
              listingData.address = trimmedValue;
              
              // Try to extract city/state from multi-line or comma-separated address
              // Format examples:
              // "23 Westbrook Industrial Park Rd., Westbrook, CT 06498"
              // "23 Main St\n1961 Foxon Rd, North Branford, CT 06471"
              const lines = trimmedValue.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
              const lastLine = lines[lines.length - 1] || trimmedValue;
              
              // Try to parse "City, ST ZIP" or "City, ST" pattern from end
              const cityStateZipMatch = lastLine.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
              if (cityStateZipMatch) {
                // Extract just the city (last part before state might be street)
                const potentialCity = cityStateZipMatch[1].trim();
                // If city contains street indicators, try to get just the city name
                const streetIndicators = /\b(rd\.?|road|st\.?|street|ave\.?|avenue|blvd\.?|boulevard|ln\.?|lane|dr\.?|drive|ct\.?|court|pl\.?|place|way|pkwy|park)\b/i;
                if (!streetIndicators.test(potentialCity)) {
                  if (!listingData.address_city) {
                    listingData.address_city = potentialCity;
                  }
                }
                if (!listingData.address_state) {
                  listingData.address_state = cityStateZipMatch[2].toUpperCase();
                }
                if (cityStateZipMatch[3] && !listingData.address_zip) {
                  listingData.address_zip = cityStateZipMatch[3];
                }
              }
            } else if (mapping.targetField === "address_state") {
              // Validate and uppercase state code
              const stateCode = trimmedValue.toUpperCase().trim();
              if (stateCode.length === 2) {
                listingData.address_state = stateCode;
              } else {
                // Try to extract state from longer string (e.g., "Connecticut" or "CT 06498")
                const stateMatch = trimmedValue.match(/\b([A-Z]{2})\b/i);
                if (stateMatch) {
                  listingData.address_state = stateMatch[1].toUpperCase();
                }
              }
            } else if (mapping.targetField === "address_country") {
              // Default to US if not specified
              const country = trimmedValue.toUpperCase().trim();
              listingData.address_country = country === "CA" || country === "CANADA" ? "CA" : "US";
            } else if (mapping.targetField === "last_contacted_at") {
              // Parse date
              const date = new Date(trimmedValue);
              if (!isNaN(date.getTime())) {
                listingData.last_contacted_at = date.toISOString();
              }
            } else {
              // String fields - direct assignment
              listingData[mapping.targetField] = trimmedValue;
            }
          });
          
          // Set default country if we have address fields but no country
          if ((listingData.address_city || listingData.address_state) && !listingData.address_country) {
            listingData.address_country = "US";
          }

          // Log what we're about to insert for debugging
          console.log(`Row ${i + 1} listingData:`, JSON.stringify(listingData, null, 2));

          // Must have a title
          if (!listingData.title) {
            results.errors.push(`Row ${i + 1}: Missing company name (check CSV column mapping)`);
            continue;
          }

          // Website is optional - deals without website won't get AI enrichment
          if (!listingData.website) {
            console.log(`Row ${i + 1}: No website - deal will be imported but won't receive AI enrichment`);
          }

          // Create listing - use any to bypass strict typing
          const { data: listing, error: listingError } = await supabase
            .from("listings")
            .insert(listingData as never)
            .select("id")
            .single();

          if (listingError) throw listingError;

          // Link to universe
          const { error: linkError } = await supabase
            .from("remarketing_universe_deals")
            .insert({
              universe_id: universeId,
              listing_id: listing.id,
              added_by: user?.id,
              status: "active",
            });

          if (linkError) throw linkError;

          results.imported++;
        } catch (error) {
          console.error(`Row ${i + 1} error:`, error);
          results.errors.push(`Row ${i + 1}: ${(error as Error).message}`);
        }
      }

      return results;
    },
    onSuccess: async (results) => {
      setImportResults(results);
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["remarketing", "universe-deals", universeId] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      
      // Trigger background enrichment for all imported deals
      if (results.imported > 0) {
        toast.info(`Triggering AI enrichment for ${results.imported} deals...`);
        // The database trigger has already queued these, but we can also trigger the processor
        supabase.functions.invoke("process-enrichment-queue", {
          body: {},
        }).then(({ data, error }) => {
          if (error) {
            console.error("Enrichment queue processing error:", error);
          } else {
            console.log("Enrichment queue processed:", data);
          }
        });
      }
      
      onImportComplete?.();
    },
    onError: (error) => {
      toast.error(`Import failed: ${(error as Error).message}`);
      setStep("preview");
    },
  });

  const startImport = () => {
    setStep("importing");
    setImportProgress(0);
    importMutation.mutate();
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

  const getMappedFieldCount = () =>
    columnMappings.filter((m) => m.targetField).length;

  const filteredColumnMappings = columnMappings.filter((m) => {
    const q = columnFilter.trim().toLowerCase();
    if (!q) return true;
    return m.csvColumn.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="border-2 border-dashed rounded-lg p-12 text-center w-full">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Upload CSV File</p>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to browse
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
                <p className="font-medium">AI is mapping columns...</p>
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
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep("preview")}
                    disabled={!columnMappings.some((m) => m.targetField === "title")}
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
                    <TableHead>#</TableHead>
                    {columnMappings
                      .filter((m) => m.targetField)
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
                        .map((m) => (
                          <TableCell key={m.csvColumn} className="max-w-[150px] truncate">
                            {row[m.csvColumn] || "—"}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {csvData.length > 10 && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Showing 10 of {csvData.length} rows
              </p>
            )}

            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button onClick={startImport}>
                <Upload className="h-4 w-4 mr-2" />
                Import {csvData.length} Deals
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 mb-4 text-primary animate-spin" />
            <p className="font-medium mb-2">Importing deals...</p>
            <Progress value={importProgress} className="w-64 mb-2" />
            <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && importResults && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            {importResults.errors.length === 0 ? (
              <Check className="h-12 w-12 mb-4 text-primary" />
            ) : (
              <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
            )}
            <p className="font-medium mb-2">
              Imported {importResults.imported} of {csvData.length} deals
            </p>

            {importResults.errors.length > 0 && (
              <ScrollArea className="max-h-32 w-full border rounded-lg p-4 mt-4">
                <div className="space-y-1 text-sm text-destructive">
                  {importResults.errors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button onClick={reset} className="mt-6">
              Import More
            </Button>
          </div>
        )}
    </div>
  );
};

export default DealCSVImport;
