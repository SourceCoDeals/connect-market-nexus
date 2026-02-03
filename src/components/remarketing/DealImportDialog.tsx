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

interface DealImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

// Target fields for listings table
const DEAL_FIELDS = [
  { value: "title", label: "Company Name", required: true },
  { value: "website", label: "Website" },
  { value: "category", label: "Industry/Category" },
  { value: "revenue", label: "Revenue" },
  { value: "ebitda", label: "EBITDA" },
  { value: "description", label: "Description" },
  { value: "executive_summary", label: "Executive Summary" },
  { value: "general_notes", label: "Notes" },
  { value: "services", label: "Services Offered" },
  { value: "geographic_states", label: "States/Geography" },
  { value: "full_time_employees", label: "Employee Count" },
  { value: "address", label: "Full Address" },
  { value: "address_city", label: "City" },
  { value: "address_state", label: "State (2-letter)" },
  { value: "address_zip", label: "ZIP Code" },
  { value: "primary_contact_name", label: "Contact Name" },
  { value: "primary_contact_first_name", label: "Contact First Name" },
  { value: "primary_contact_last_name", label: "Contact Last Name" },
  { value: "primary_contact_email", label: "Contact Email" },
  { value: "primary_contact_phone", label: "Contact Phone" },
  { value: "primary_contact_title", label: "Contact Title/Role" },
  { value: "internal_company_name", label: "Internal Company Name" },
  { value: "internal_notes", label: "Internal Notes" },
  { value: "owner_goals", label: "Owner Goals" },
  { value: "number_of_locations", label: "Number of Locations" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "transcript_url", label: "Transcript/Recording URL" },
  { value: "google_review_count", label: "Google Review Count" },
  { value: "google_review_score", label: "Google Review Score" },
  { value: "status", label: "Deal Status" },
  { value: "fit_assessment", label: "Fit Assessment (Yes/No)" },
  { value: "last_contacted_at", label: "Last Contacted Date" },
];

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
  const [isMapping, setIsMapping] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    imported: number;
    errors: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as Record<string, string>[];
        setCsvData(data);

        // Get column names
        const columns = Object.keys(data[0] || {}).filter(col => col.trim());
        
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

          setColumnMappings(
            mappingResult.mappings || columns.map((col) => ({
              csvColumn: col,
              targetField: null,
              confidence: 0,
              aiSuggested: false,
            }))
          );
        } catch (error) {
          console.error("AI mapping failed:", error);
          // Fallback to empty mapping
          setColumnMappings(
            columns.map((col) => ({
              csvColumn: col,
              targetField: null,
              confidence: 0,
              aiSuggested: false,
            }))
          );
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

  const parseNumericValue = (value: string | null | undefined): number | null => {
    if (!value) return null;
    // Remove currency symbols, commas, and other non-numeric characters except . and -
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const parseArrayValue = (value: string | null | undefined): string[] => {
    if (!value) return [];
    // Split by common delimiters
    return value.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  };

  const handleImport = async () => {
    setStep("importing");
    setIsImporting(true);
    setImportProgress(0);

    const results = { imported: 0, errors: [] as string[] };
    const { data: { user } } = await supabase.auth.getUser();

    try {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        setImportProgress(Math.round(((i + 1) / csvData.length) * 100));

        try {
          // Build listing object from mappings
          const listingData: Record<string, any> = {
            is_active: true,
            created_by: user?.id,
            status: 'active',
          };

          // Track first/last name separately to combine later
          let firstName = '';
          let lastName = '';

          columnMappings.forEach((mapping) => {
            if (mapping.targetField && row[mapping.csvColumn]) {
              const value = row[mapping.csvColumn]?.trim();
              if (!value) return;
              
              const field = mapping.targetField;
              
              // Handle numeric fields
              if (field === "revenue" || field === "ebitda" || field === "google_review_score") {
                listingData[field] = parseNumericValue(value);
              }
              // Handle integer fields
              else if (field === "full_time_employees" || field === "number_of_locations" || field === "google_review_count") {
                const num = parseNumericValue(value);
                listingData[field] = num ? Math.round(num) : null;
              }
              // Handle array fields
              else if (field === "services" || field === "geographic_states") {
                listingData[field] = parseArrayValue(value);
              }
              // Handle state code normalization
              else if (field === "address_state") {
                const stateCode = value.toUpperCase().trim();
                // Accept 2-letter codes or try to extract from longer strings
                if (stateCode.length === 2) {
                  listingData[field] = stateCode;
                } else {
                  // Try to find a 2-letter code at the end
                  const match = stateCode.match(/\b([A-Z]{2})\s*$/);
                  if (match) listingData[field] = match[1];
                }
              }
              // Handle first/last name separately for combining
              else if (field === "primary_contact_first_name") {
                firstName = value;
              }
              else if (field === "primary_contact_last_name") {
                lastName = value;
              }
              // Handle date fields
              else if (field === "last_contacted_at") {
                try {
                  const parsed = new Date(value);
                  if (!isNaN(parsed.getTime())) {
                    listingData[field] = parsed.toISOString();
                  }
                } catch {
                  // Invalid date, skip
                }
              }
              // Handle fit_assessment as boolean-like
              else if (field === "fit_assessment") {
                const lowerVal = value.toLowerCase();
                if (lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1' || lowerVal === 'fit') {
                  listingData.internal_notes = (listingData.internal_notes || '') + '\n[Fit: Yes]';
                } else if (lowerVal === 'no' || lowerVal === 'false' || lowerVal === '0' || lowerVal === 'not fit') {
                  listingData.internal_notes = (listingData.internal_notes || '') + '\n[Fit: No]';
                }
              }
              // Handle status mapping
              else if (field === "status") {
                // Map common status values to our schema
                const lowerVal = value.toLowerCase();
                if (lowerVal.includes('active') || lowerVal.includes('evaluation')) {
                  listingData.status = 'active';
                } else if (lowerVal.includes('closed') || lowerVal.includes('sold')) {
                  listingData.status = 'sold';
                } else if (lowerVal.includes('inactive') || lowerVal.includes('archived')) {
                  listingData.status = 'inactive';
                }
              }
              // Handle transcript/recording URLs
              else if (field === "transcript_url") {
                // Store in internal_notes with a label since we don't have a dedicated column
                listingData.internal_notes = (listingData.internal_notes || '') + `\n[Transcript: ${value}]`;
              }
              // Default: string fields
              else {
                listingData[field] = value;
              }
            }
          });

          // Combine first + last name into primary_contact_name
          if (firstName || lastName) {
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) {
              listingData.primary_contact_name = fullName;
            }
          }

          // Must have a title
          if (!listingData.title) {
            results.errors.push(`Row ${i + 2}: Missing company name`);
            continue;
          }

          // Set default category if not mapped
          if (!listingData.category) {
            listingData.category = "Other";
          }

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
    setImportProgress(0);
    setImportResults(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const getMappedFieldCount = () =>
    columnMappings.filter((m) => m.targetField).length;

  const hasRequiredField = columnMappings.some(m => m.targetField === "title");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{csvData.length} rows</Badge>
                      <Badge variant="outline">
                        {getMappedFieldCount()}/{columnMappings.length} mapped
                      </Badge>
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

                  <ScrollArea className="flex-1 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">CSV Column</TableHead>
                          <TableHead className="w-[250px]">Sample Value</TableHead>
                          <TableHead className="w-[200px]">Map To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {columnMappings.map((mapping) => (
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
                                  {DEAL_FIELDS.map((field) => (
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
                    DEAL_FIELDS.find((f) => f.value === m.targetField)?.label
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
                            {DEAL_FIELDS.find((f) => f.value === m.targetField)?.label}
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
                    <Check className="h-12 w-12 mx-auto text-green-500" />
                  ) : (
                    <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
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
