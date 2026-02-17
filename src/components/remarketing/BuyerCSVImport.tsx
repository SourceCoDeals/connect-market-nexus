import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { useGlobalGateCheck } from "@/hooks/remarketing/useGlobalActivityQueue";

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

interface SkippedRowDetail {
  index: number;
  companyName: string;
  reason: string;
}

// Extended target fields based on the spec
const TARGET_FIELDS = [
  { value: 'company_name', label: 'Platform Company Name', required: true, description: 'Name of the portfolio company' },
  { value: 'platform_website', label: 'Platform Website', required: false, description: 'Website URL of the portfolio company' },
  { value: 'pe_firm_name', label: 'PE Firm Name', required: false, description: 'Name of the private equity firm' },
  { value: 'pe_firm_website', label: 'PE Firm Website', required: false, description: 'Website URL of the PE firm' },
  { value: 'company_website', label: 'Company Website (General)', required: false, description: 'General website URL' },
  { value: 'buyer_type', label: 'Buyer Type', required: false, description: 'Type of buyer (PE firm, platform, strategic, family office)' },
  { value: 'investment_date', label: 'Investment Date', required: false, description: 'Date PE firm invested in the platform' },
  { value: 'hq_city_state', label: 'HQ City & State (combined)', required: false, description: 'Combined city and state (will be parsed)' },
  { value: 'hq_city', label: 'HQ City', required: false, description: 'Headquarters city' },
  { value: 'hq_state', label: 'HQ State', required: false, description: 'Headquarters state (2-letter code preferred)' },
  { value: 'hq_country', label: 'HQ Country', required: false, description: 'Headquarters country' },
  { value: 'thesis_summary', label: 'Investment Thesis', required: false, description: 'Investment thesis or focus areas' },
  { value: 'target_revenue_min', label: 'Min Revenue', required: false, description: 'Minimum target revenue' },
  { value: 'target_revenue_max', label: 'Max Revenue', required: false, description: 'Maximum target revenue' },
  { value: 'target_ebitda_min', label: 'Min EBITDA', required: false, description: 'Minimum target EBITDA' },
  { value: 'target_ebitda_max', label: 'Max EBITDA', required: false, description: 'Maximum target EBITDA' },
  { value: 'target_geographies', label: 'Target Geographies', required: false, description: 'Target states or regions' },
  { value: 'target_services', label: 'Target Services', required: false, description: 'Target services or industries' },
  { value: 'geographic_footprint', label: 'Current Footprint', required: false, description: 'Current operating locations' },
  { value: 'notes', label: 'Notes', required: false, description: 'Additional notes' },
];

interface DuplicateWarning {
  index: number;
  companyName: string;
  potentialDuplicates: Array<{
    id: string;
    companyName: string;
    confidence: number;
    matchType: 'domain' | 'name';
  }>;
}

interface BuyerCSVImportProps {
  universeId?: string;
  onComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

// Normalize domain for comparison
function normalizeDomain(url: string): string {
  if (!url) return '';
  let normalized = url.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.split('/')[0];
  normalized = normalized.split(':')[0];
  return normalized;
}

export const BuyerCSVImport = ({ universeId, onComplete, open: controlledOpen, onOpenChange, hideTrigger = false }: BuyerCSVImportProps) => {
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use controlled or uncontrolled mode
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (value: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'dedupe' | 'importing' | 'enriching'>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });
  const [importResults, setImportResults] = useState<{ success: number; errors: number; enriched: number }>({ success: 0, errors: 0, enriched: 0 });
  const [duplicates, setDuplicates] = useState<DuplicateWarning[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState<Set<number>>(new Set());
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [skippedRowsOpen, setSkippedRowsOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Validate rows based on website requirement (at least one website)
  const { validRows, skippedRows, skippedRowDetails } = useMemo(() => {
    const valid: { index: number; row: CSVRow }[] = [];
    const skipped: { index: number; row: CSVRow }[] = [];
    const skippedDetails: SkippedRowDetail[] = [];

    csvData.forEach((row, index) => {
      // Get website values based on current mappings
      let platformWebsite: string | null = null;
      let peFirmWebsite: string | null = null;
      let companyWebsite: string | null = null;
      let companyName: string | null = null;

      mappings.forEach(mapping => {
        if (mapping.targetField && row[mapping.csvColumn]) {
          const value = row[mapping.csvColumn].trim();
          if (mapping.targetField === 'platform_website') platformWebsite = value;
          if (mapping.targetField === 'pe_firm_website') peFirmWebsite = value;
          if (mapping.targetField === 'company_website') companyWebsite = value;
          if (mapping.targetField === 'company_name') companyName = value;
        }
      });

      const hasAnyWebsite = !!platformWebsite || !!peFirmWebsite || !!companyWebsite;
      const hasCompanyName = !!companyName;

      if (hasCompanyName && hasAnyWebsite) {
        valid.push({ index, row });
      } else if (hasCompanyName) {
        // Has name but no website - still import but note it
        valid.push({ index, row });
      } else {
        skipped.push({ index, row });
        skippedDetails.push({
          index,
          companyName: companyName || `Row ${index + 2}`,
          reason: !hasCompanyName ? 'Missing company name' : 'Missing website'
        });
      }
    });

    return { validRows: valid, skippedRows: skipped, skippedRowDetails: skippedDetails };
  }, [csvData, mappings]);

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
        await analyzeColumnsWithAI(headers, data.slice(0, 3));
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    });
  }, []);

  const analyzeColumnsWithAI = async (headers: string[], sampleRows: CSVRow[]) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('map-csv-columns', {
        body: { 
          columns: headers, 
          targetType: 'buyer',
          sampleData: sampleRows 
        }
      });

      if (error) {
        console.error('AI mapping error:', error);
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
    
    // Platform/Company name
    if (lower.includes('platform') && (lower.includes('company') || lower.includes('name'))) return 'company_name';
    if (lower.includes('company') || lower.includes('name') || lower.includes('firm')) return 'company_name';
    
    // Websites - be specific about platform vs PE firm
    if (lower.includes('platform') && (lower.includes('website') || lower.includes('url'))) return 'platform_website';
    if ((lower.includes('pe') || lower.includes('firm')) && (lower.includes('website') || lower.includes('url'))) return 'pe_firm_website';
    if (lower.includes('website') || lower.includes('url') || lower.includes('site')) return 'company_website';
    
    // PE Firm name
    if ((lower.includes('pe') || lower.includes('private equity') || lower.includes('sponsor')) && lower.includes('name')) return 'pe_firm_name';
    if (lower.includes('pe firm') || lower.includes('sponsor')) return 'pe_firm_name';
    
    // Location
    if (lower.includes('hq') && lower.includes('city') && lower.includes('state')) return 'hq_city_state';
    if (lower.includes('city') && lower.includes('state')) return 'hq_city_state';
    if (lower.includes('city')) return 'hq_city';
    if (lower.includes('state') && !lower.includes('target')) return 'hq_state';
    if (lower.includes('country')) return 'hq_country';
    
    // Type
    if (lower.includes('type') || lower.includes('category')) return 'buyer_type';
    
    // Thesis
    if (lower.includes('thesis') || lower.includes('focus') || lower.includes('strategy')) return 'thesis_summary';
    
    // Financial
    if ((lower.includes('revenue') || lower.includes('rev')) && lower.includes('min')) return 'target_revenue_min';
    if ((lower.includes('revenue') || lower.includes('rev')) && lower.includes('max')) return 'target_revenue_max';
    if (lower.includes('ebitda') && lower.includes('min')) return 'target_ebitda_min';
    if (lower.includes('ebitda') && lower.includes('max')) return 'target_ebitda_max';
    
    // Geography and services
    if (lower.includes('target') && (lower.includes('geography') || lower.includes('state') || lower.includes('region'))) return 'target_geographies';
    if (lower.includes('service') || lower.includes('industry') || lower.includes('sector')) return 'target_services';
    if (lower.includes('footprint') || lower.includes('location') || lower.includes('presence') || lower.includes('current')) return 'geographic_footprint';
    
    // Investment date
    if (lower.includes('investment') && lower.includes('date')) return 'investment_date';
    if (lower.includes('invested') && lower.includes('date')) return 'investment_date';
    if (lower === 'investment date') return 'investment_date';
    
    // Notes
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

  const hasWebsiteMapping = () => {
    return mappings.some(m => 
      m.targetField === 'platform_website' || 
      m.targetField === 'pe_firm_website' || 
      m.targetField === 'company_website'
    );
  };

  const buildBuyerFromRow = (row: CSVRow) => {
    const buyer: Record<string, any> = {
      universe_id: universeId || null,
    };

    mappings.forEach(mapping => {
      if (mapping.targetField && row[mapping.csvColumn]) {
        const value = row[mapping.csvColumn].trim();
        
        // Handle combined city/state
        if (mapping.targetField === 'hq_city_state') {
          const parts = value.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            buyer['hq_city'] = parts[0];
            buyer['hq_state'] = parts[parts.length - 1]; // Last part is usually state
          } else {
            buyer['hq_city'] = value;
          }
          return;
        }
        
        // Handle website normalization
        if (['platform_website', 'pe_firm_website', 'company_website'].includes(mapping.targetField)) {
          buyer[mapping.targetField] = normalizeDomain(value);
          return;
        }
        
        // Handle arrays
        if (['target_geographies', 'target_services', 'geographic_footprint'].includes(mapping.targetField)) {
          buyer[mapping.targetField] = value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
          return;
        }
        
        // Handle numbers
        if (['target_revenue_min', 'target_revenue_max', 'target_ebitda_min', 'target_ebitda_max'].includes(mapping.targetField)) {
          const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) {
            buyer[mapping.targetField] = num;
          }
          return;
        }
        
        // Handle buyer type
        if (mapping.targetField === 'buyer_type') {
          const lower = value.toLowerCase();
          if (lower.includes('pe') || lower.includes('private equity')) buyer.buyer_type = 'pe_firm';
          else if (lower.includes('platform')) buyer.buyer_type = 'platform';
          else if (lower.includes('strategic')) buyer.buyer_type = 'strategic';
          else if (lower.includes('family')) buyer.buyer_type = 'family_office';
          else buyer.buyer_type = 'other';
          return;
        }
        
        // Handle investment date - parse various formats
        if (mapping.targetField === 'investment_date') {
          // Try to parse the date in various formats
          let dateValue = value;
          
          // Handle "2025-11" format (YYYY-MM) by adding day
          if (/^\d{4}-\d{1,2}$/.test(value)) {
            dateValue = `${value}-01`;
          }
          // Handle "11/2025" or "11-2025" format (MM/YYYY)
          else if (/^\d{1,2}[/-]\d{4}$/.test(value)) {
            const parts = value.split(/[/-]/);
            dateValue = `${parts[1]}-${parts[0].padStart(2, '0')}-01`;
          }
          // Handle "Nov 2025" or "November 2025" format
          else if (/^[a-zA-Z]+\s+\d{4}$/.test(value)) {
            const parsed = new Date(value + ' 01');
            if (!isNaN(parsed.getTime())) {
              dateValue = parsed.toISOString().split('T')[0];
            }
          }
          
          buyer[mapping.targetField] = dateValue;
          return;
        }
        
        // Standard field assignment
        buyer[mapping.targetField] = value;
      }
    });

    // If pe_firm_name not set but we have it as company name, infer
    if (!buyer.pe_firm_name && buyer.buyer_type === 'pe_firm') {
      buyer.pe_firm_name = buyer.company_name;
    }

    return buyer;
  };

  const proceedToPreview = () => {
    if (!hasRequiredMapping()) {
      toast.error('Company Name mapping is required');
      return;
    }
    setStep('preview');
  };

  const checkForDuplicates = async () => {
    if (!hasRequiredMapping()) {
      toast.error('Company Name mapping is required');
      return;
    }

    setIsCheckingDuplicates(true);
    
    try {
      const buyersToCheck = validRows.map(({ index, row }) => {
        const buyer = buildBuyerFromRow(row);
        return {
          index,
          companyName: buyer.company_name || '',
          website: buyer.platform_website || buyer.pe_firm_website || buyer.company_website || null,
        };
      }).filter(b => b.companyName);

      const { data, error } = await supabase.functions.invoke('dedupe-buyers', {
        body: { buyers: buyersToCheck }
      });

      if (error) {
        console.error('Dedupe check error:', error);
        await handleImport();
        return;
      }

      const foundDuplicates = (data?.results || []).filter((r: any) => r.isDuplicate);
      
      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setStep('dedupe');
      } else {
        await handleImport();
      }
    } catch (err) {
      console.error('Dedupe error:', err);
      await handleImport();
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const toggleSkipDuplicate = (index: number) => {
    setSkipDuplicates(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!hasRequiredMapping()) {
      toast.error('Company Name mapping is required');
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0, enriched: 0 });

    const batchSize = 10;
    let success = 0;
    let errors = 0;
    const insertedBuyers: Array<{ id: string; platform_website?: string; pe_firm_website?: string; company_website?: string }> = [];

    // Filter out skipped duplicates
    const dataToImport = validRows.filter(({ index }) => !skipDuplicates.has(index));

    for (let i = 0; i < dataToImport.length; i += batchSize) {
      const batch = dataToImport.slice(i, i + batchSize);
      
      const buyersToInsert = batch
        .map(({ row }) => buildBuyerFromRow(row))
        .filter((b): b is typeof b & { company_name: string } => !!b.company_name);

      if (buyersToInsert.length > 0) {
        const { data, error } = await supabase
          .from('remarketing_buyers')
          .insert(buyersToInsert as any)
          .select('id, platform_website, pe_firm_website, company_website');

        if (error) {
          console.error('Insert error:', error);
          errors += buyersToInsert.length;
        } else {
          success += buyersToInsert.length;
          if (data) {
            insertedBuyers.push(...data);
          }
        }
      }

      setImportProgress(((i + batchSize) / dataToImport.length) * 100);
    }

    setImportResults(prev => ({ ...prev, success, errors }));
    
    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'buyers'] });
      toast.success(`Imported ${success} buyers`);
      
      // Trigger enrichment for buyers with websites
      const enrichableBuyers = insertedBuyers.filter(
        b => b.platform_website || b.pe_firm_website || b.company_website
      );
      
      if (enrichableBuyers.length > 0) {
        await triggerBulkEnrichment(enrichableBuyers);
      }
    }
    
    if (errors > 0) {
      toast.error(`Failed to import ${errors} buyers`);
    }

    onComplete?.();
  };

  const triggerBulkEnrichment = async (
    buyers: Array<{ id: string; platform_website?: string; pe_firm_website?: string; company_website?: string }>
  ) => {
    setStep('enriching');
    setEnrichmentProgress({ current: 0, total: buyers.length });

    // Gate check: register as major operation
    const { data: sessionData } = await supabase.auth.getUser();
    const { queued } = await startOrQueueMajorOp({
      operationType: 'buyer_enrichment',
      totalItems: buyers.length,
      description: `Enrich ${buyers.length} imported buyers`,
      userId: sessionData?.user?.id || 'unknown',
    });
    if (queued) {
      // Queued for later — skip inline enrichment
      setEnrichmentProgress({ current: buyers.length, total: buyers.length });
      toast.info('Enrichment queued — another operation is running. It will start automatically.');
      return;
    }

    let enriched = 0;
    let failed = 0;
    let creditsDepleted = false;

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1000;

    // Process in parallel batches
    for (let i = 0; i < buyers.length; i += BATCH_SIZE) {
      // Check if credits depleted - stop immediately
      if (creditsDepleted) break;

      const batch = buyers.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (buyer) => {
          const { data, error } = await invokeWithTimeout<any>('enrich-buyer', {
            body: { buyerId: buyer.id },
            timeoutMs: 180_000,
          });
          
          if (error) throw error;
          
          // Check for error in response body
          if (data && !data.success) {
            const errorObj = new Error(data.error || 'Enrichment failed');
            (errorObj as any).errorCode = data.error_code;
            throw errorObj;
          }
          
          return data;
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          enriched++;
        } else {
          failed++;
          const error = result.reason;
          const errorCode = (error as any)?.errorCode;
          const errorMessage = error?.message || '';

          // Check for payment/credits error - fail fast
          if (
            errorCode === 'payment_required' ||
            errorMessage.includes('402') ||
            errorMessage.includes('credits') ||
            errorMessage.includes('payment')
          ) {
            creditsDepleted = true;
            toast.error(
              'AI credits depleted. Please add credits in Settings → Workspace → Usage to continue.',
              { duration: 10000 }
            );
            break;
          }
        }
      }

      setEnrichmentProgress({ current: Math.min(i + BATCH_SIZE, buyers.length), total: buyers.length });

      // Delay between batches (not after last batch or if credits depleted)
      if (i + BATCH_SIZE < buyers.length && !creditsDepleted) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    setImportResults(prev => ({ ...prev, enriched }));
    
    if (creditsDepleted) {
      toast.warning(`Enrichment stopped. ${enriched} buyers enriched before credits ran out.`);
    } else {
      toast.success(`Enriched ${enriched} of ${buyers.length} buyers`);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setMappings([]);
    setImportProgress(0);
    setEnrichmentProgress({ current: 0, total: 0 });
    setImportResults({ success: 0, errors: 0, enriched: 0 });
    setDuplicates([]);
    setSkipDuplicates(new Set());
    setSkippedRowsOpen(false);
  };

  const isComplete = step === 'enriching' 
    ? enrichmentProgress.current >= enrichmentProgress.total 
    : step === 'importing' && importProgress >= 100;

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetImport();
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Buyers from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import buyers. AI will help map your columns.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={step === 'upload' ? 'default' : 'outline'}>1. Upload</Badge>
            <ChevronRight className="h-3 w-3" />
            <Badge variant={step === 'mapping' ? 'default' : 'outline'}>2. Map Columns</Badge>
            <ChevronRight className="h-3 w-3" />
            <Badge variant={step === 'preview' ? 'default' : 'outline'}>3. Preview</Badge>
            <ChevronRight className="h-3 w-3" />
            <Badge variant={step === 'importing' || step === 'enriching' ? 'default' : 'outline'}>4. Import</Badge>
          </div>

          <ScrollArea className="flex-1 pr-4">
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
                            <TableCell className="text-muted-foreground text-xs truncate max-w-[150px]">
                              {csvData[0]?.[mapping.csvColumn] || '—'}
                            </TableCell>
                            <TableCell>
                              {mapping.targetField ? (
                                <Badge variant={mapping.aiSuggested ? "secondary" : "default"} className="text-xs">
                                  {mapping.aiSuggested ? 'AI' : 'Set'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Skip</Badge>
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

            {step === 'preview' && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{validRows.length} buyers will be imported</p>
                    {skippedRows.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {skippedRows.length} rows will be skipped
                      </p>
                    )}
                  </div>
                  {hasWebsiteMapping() && (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Will auto-enrich
                    </Badge>
                  )}
                </div>

                {/* Skipped rows warning */}
                {skippedRows.length > 0 && (
                  <Collapsible open={skippedRowsOpen} onOpenChange={setSkippedRowsOpen}>
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-400">
                          {skippedRows.length} rows will be skipped
                        </p>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-0 text-amber-600">
                            {skippedRowsOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                            {skippedRowsOpen ? 'Hide details' : 'Show details'}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="border rounded-lg overflow-hidden mt-2 max-h-32 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Row</TableHead>
                              <TableHead className="text-xs">Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {skippedRowDetails.map((item) => (
                              <TableRow key={item.index}>
                                <TableCell className="text-xs">{item.companyName}</TableCell>
                                <TableCell className="text-xs text-amber-600">{item.reason}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Preview table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[250px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {mappings.filter(m => m.targetField).slice(0, 5).map(m => (
                            <TableHead key={m.csvColumn} className="text-xs whitespace-nowrap">
                              {TARGET_FIELDS.find(f => f.value === m.targetField)?.label || m.targetField}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRows.slice(0, 5).map(({ index, row }) => (
                          <TableRow key={index}>
                            {mappings.filter(m => m.targetField).slice(0, 5).map(m => (
                              <TableCell key={m.csvColumn} className="text-xs truncate max-w-[150px]">
                                {row[m.csvColumn] || '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {validRows.length > 5 && (
                          <TableRow>
                            <TableCell 
                              colSpan={Math.min(5, mappings.filter(m => m.targetField).length)} 
                              className="text-center text-xs text-muted-foreground"
                            >
                              ...and {validRows.length - 5} more
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {step === 'dedupe' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Found {duplicates.length} potential duplicate(s). Review and select which to skip.
                  </span>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {duplicates.map((dup) => (
                    <div 
                      key={dup.index}
                      className={`p-3 border rounded-lg ${skipDuplicates.has(dup.index) ? 'bg-muted/50 opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{dup.companyName}</p>
                          <p className="text-xs text-muted-foreground">
                            Matches: {dup.potentialDuplicates.map(d => d.companyName).join(', ')}
                          </p>
                        </div>
                        <Button 
                          variant={skipDuplicates.has(dup.index) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => toggleSkipDuplicate(dup.index)}
                        >
                          {skipDuplicates.has(dup.index) ? 'Skipping' : 'Skip'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {validRows.length - skipDuplicates.size} buyers will be imported
                </p>
              </div>
            )}

            {(step === 'importing' || step === 'enriching') && (
              <div className="py-8 space-y-4">
                <Progress 
                  value={step === 'enriching' 
                    ? (enrichmentProgress.total > 0 ? (enrichmentProgress.current / enrichmentProgress.total) * 100 : 0)
                    : importProgress
                  } 
                  className="h-2" 
                />
                <p className="text-center text-sm text-muted-foreground">
                  {step === 'importing' && importProgress < 100 && (
                    <>Importing buyers... {Math.round(importProgress)}%</>
                  )}
                  {step === 'enriching' && enrichmentProgress.current < enrichmentProgress.total && (
                    <>
                      <Sparkles className="inline h-4 w-4 mr-1" />
                      Enriching buyers... {enrichmentProgress.current} of {enrichmentProgress.total}
                    </>
                  )}
                  {isComplete && (
                    <>
                      Import complete!
                      <br />
                      <span className="text-emerald-600">{importResults.success} imported</span>
                      {importResults.enriched > 0 && (
                        <>, <span className="text-blue-600">{importResults.enriched} enriched</span></>
                      )}
                      {importResults.errors > 0 && (
                        <>, <span className="text-destructive">{importResults.errors} failed</span></>
                      )}
                    </>
                  )}
                </p>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            {step === 'mapping' && !isAnalyzing && (
              <>
                <Button variant="outline" onClick={resetImport}>
                  Back
                </Button>
                <Button 
                  onClick={proceedToPreview}
                  disabled={!hasRequiredMapping()}
                >
                  Preview Import
                </Button>
              </>
            )}
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Back
                </Button>
                <Button 
                  onClick={checkForDuplicates}
                  disabled={isCheckingDuplicates || validRows.length === 0}
                >
                  {isCheckingDuplicates ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    `Import ${validRows.length} Buyers`
                  )}
                </Button>
              </>
            )}
            {step === 'dedupe' && (
              <>
                <Button variant="outline" onClick={() => setStep('preview')}>
                  Back
                </Button>
                <Button onClick={handleImport}>
                  Continue Import ({validRows.length - skipDuplicates.size} buyers)
                </Button>
              </>
            )}
            {(step === 'importing' || step === 'enriching') && isComplete && (
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
