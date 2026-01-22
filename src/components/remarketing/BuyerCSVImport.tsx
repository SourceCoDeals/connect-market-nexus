import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  Loader2,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

const TARGET_FIELDS = [
  { value: 'company_name', label: 'Company Name', required: true },
  { value: 'company_website', label: 'Website', required: false },
  { value: 'buyer_type', label: 'Buyer Type', required: false },
  { value: 'thesis_summary', label: 'Investment Thesis', required: false },
  { value: 'target_revenue_min', label: 'Min Revenue', required: false },
  { value: 'target_revenue_max', label: 'Max Revenue', required: false },
  { value: 'target_ebitda_min', label: 'Min EBITDA', required: false },
  { value: 'target_ebitda_max', label: 'Max EBITDA', required: false },
  { value: 'target_geographies', label: 'Target Geographies', required: false },
  { value: 'target_services', label: 'Target Services', required: false },
  { value: 'geographic_footprint', label: 'Current Footprint', required: false },
  { value: 'notes', label: 'Notes', required: false },
];

interface BuyerCSVImportProps {
  universeId?: string;
  onComplete?: () => void;
}

export const BuyerCSVImport = ({ universeId, onComplete }: BuyerCSVImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });
  
  const queryClient = useQueryClient();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as CSVRow[];
        const headers = results.meta.fields || [];
        
        if (data.length === 0) {
          toast.error('CSV file is empty');
          return;
        }

        setCsvData(data);
        setCsvHeaders(headers);
        setStep('mapping');
        
        // Analyze columns with AI
        await analyzeColumnsWithAI(headers);
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    });
  }, []);

  const analyzeColumnsWithAI = async (headers: string[]) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('map-csv-columns', {
        body: { columns: headers, targetType: 'buyer' }
      });

      if (error) {
        console.error('AI mapping error:', error);
        // Fall back to basic heuristic mapping
        setMappings(headers.map(col => ({
          csvColumn: col,
          targetField: guessMapping(col),
          confidence: 0.5,
          aiSuggested: false
        })));
      } else {
        setMappings(data.mappings || headers.map(col => ({
          csvColumn: col,
          targetField: guessMapping(col),
          confidence: 0.5,
          aiSuggested: false
        })));
      }
    } catch (err) {
      console.error('Column analysis error:', err);
      // Fall back to heuristic mapping
      setMappings(headers.map(col => ({
        csvColumn: col,
        targetField: guessMapping(col),
        confidence: 0.5,
        aiSuggested: false
      })));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const guessMapping = (column: string): string | null => {
    const lower = column.toLowerCase();
    if (lower.includes('company') || lower.includes('name') || lower.includes('firm')) return 'company_name';
    if (lower.includes('website') || lower.includes('url') || lower.includes('site')) return 'company_website';
    if (lower.includes('type') || lower.includes('category')) return 'buyer_type';
    if (lower.includes('thesis') || lower.includes('focus') || lower.includes('strategy')) return 'thesis_summary';
    if (lower.includes('revenue') && lower.includes('min')) return 'target_revenue_min';
    if (lower.includes('revenue') && lower.includes('max')) return 'target_revenue_max';
    if (lower.includes('ebitda') && lower.includes('min')) return 'target_ebitda_min';
    if (lower.includes('ebitda') && lower.includes('max')) return 'target_ebitda_max';
    if (lower.includes('geography') || lower.includes('state') || lower.includes('region')) return 'target_geographies';
    if (lower.includes('service') || lower.includes('industry') || lower.includes('sector')) return 'target_services';
    if (lower.includes('footprint') || lower.includes('location') || lower.includes('presence')) return 'geographic_footprint';
    if (lower.includes('note')) return 'notes';
    return null;
  };

  const updateMapping = (csvColumn: string, targetField: string | null) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, targetField, aiSuggested: false }
        : m
    ));
  };

  const hasRequiredMapping = () => {
    return mappings.some(m => m.targetField === 'company_name');
  };

  const handleImport = async () => {
    if (!hasRequiredMapping()) {
      toast.error('Company Name mapping is required');
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0 });

    const batchSize = 10;
    let success = 0;
    let errors = 0;

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      
      const buyersToInsert = batch.map(row => {
        const buyer: Record<string, any> = {
          universe_id: universeId || null,
        };

        mappings.forEach(mapping => {
          if (mapping.targetField && row[mapping.csvColumn]) {
            const value = row[mapping.csvColumn].trim();
            
            // Handle array fields
            if (['target_geographies', 'target_services', 'geographic_footprint'].includes(mapping.targetField)) {
              buyer[mapping.targetField] = value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
            }
            // Handle numeric fields
            else if (['target_revenue_min', 'target_revenue_max', 'target_ebitda_min', 'target_ebitda_max'].includes(mapping.targetField)) {
              const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
              if (!isNaN(num)) {
                buyer[mapping.targetField] = num;
              }
            }
            // Handle buyer type
            else if (mapping.targetField === 'buyer_type') {
              const lower = value.toLowerCase();
              if (lower.includes('pe') || lower.includes('private equity')) buyer.buyer_type = 'pe_firm';
              else if (lower.includes('platform')) buyer.buyer_type = 'platform';
              else if (lower.includes('strategic')) buyer.buyer_type = 'strategic';
              else if (lower.includes('family')) buyer.buyer_type = 'family_office';
              else buyer.buyer_type = 'other';
            }
            else {
              buyer[mapping.targetField] = value;
            }
          }
        });

        return buyer;
      }).filter((b): b is typeof b & { company_name: string } => !!b.company_name);

      if (buyersToInsert.length > 0) {
        const { error } = await supabase
          .from('remarketing_buyers')
          .insert(buyersToInsert as any);

        if (error) {
          console.error('Insert error:', error);
          errors += buyersToInsert.length;
        } else {
          success += buyersToInsert.length;
        }
      }

      setImportProgress(((i + batchSize) / csvData.length) * 100);
    }

    setImportResults({ success, errors });
    
    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      toast.success(`Imported ${success} buyers`);
    }
    
    if (errors > 0) {
      toast.error(`Failed to import ${errors} buyers`);
    }

    onComplete?.();
  };

  const resetImport = () => {
    setStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setMappings([]);
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0 });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetImport();
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Buyers from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import buyers. AI will help map your columns.
            </DialogDescription>
          </DialogHeader>

          {step === 'upload' && (
            <div className="py-8">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV files only</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>AI is analyzing your columns...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    AI has suggested mappings. Review and adjust as needed.
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CSV Column</TableHead>
                        <TableHead>Map To</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping) => (
                        <TableRow key={mapping.csvColumn}>
                          <TableCell className="font-medium">{mapping.csvColumn}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.targetField || 'skip'}
                              onValueChange={(value) => updateMapping(mapping.csvColumn, value === 'skip' ? null : value)}
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
                          <TableCell>
                            {mapping.targetField ? (
                              <Badge variant={mapping.aiSuggested ? "secondary" : "default"}>
                                {mapping.aiSuggested ? 'AI' : 'Manual'}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Skip</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {!hasRequiredMapping() && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Company Name mapping is required
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {csvData.length} rows found in CSV
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 space-y-4">
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {importProgress < 100 ? (
                  <>Importing buyers... {Math.round(importProgress)}%</>
                ) : (
                  <>
                    Import complete!
                    <br />
                    <span className="text-emerald-600">{importResults.success} succeeded</span>
                    {importResults.errors > 0 && (
                      <>, <span className="text-destructive">{importResults.errors} failed</span></>
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          <DialogFooter>
            {step === 'mapping' && !isAnalyzing && (
              <>
                <Button variant="outline" onClick={resetImport}>
                  Back
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={!hasRequiredMapping()}
                >
                  Import {csvData.length} Buyers
                </Button>
              </>
            )}
            {step === 'importing' && importProgress >= 100 && (
              <Button onClick={() => {
                setIsOpen(false);
                resetImport();
              }}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BuyerCSVImport;
