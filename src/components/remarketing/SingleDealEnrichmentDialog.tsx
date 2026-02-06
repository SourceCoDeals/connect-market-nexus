import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Globe, FileText, Zap, MessageSquare } from "lucide-react";

export interface SingleDealEnrichmentResult {
  success: boolean;
  message?: string;
  fieldsUpdated?: string[];
  error?: string;
  extracted?: Record<string, unknown>;
  scrapeReport?: {
    totalPagesAttempted: number;
    successfulPages: number;
    totalCharactersScraped: number;
    pages: Array<{ url: string; success: boolean; chars: number }>;
  };
  transcriptReport?: {
    totalTranscripts: number;
    processed: number;
    errors: string[];
  };
}

// Map database field names to human-readable labels
const FIELD_LABELS: Record<string, string> = {
  executive_summary: "Executive Summary",
  business_model: "Business Model",
  geographic_states: "Geographic States",
  industry: "Industry",
  services: "Services",
  service_mix: "Service Mix",
  customer_types: "Customer Types",
  address: "Address",
  address_city: "City",
  address_state: "State",
  street_address: "Street Address",
  founded_year: "Founded Year",
  revenue: "Revenue",
  ebitda: "EBITDA",
  full_time_employees: "Employees",
  website: "Website",
  location: "Location",
  company_name: "Company Name",
  internal_company_name: "Company Name",
  deal_summary: "Deal Summary",
  owner_goals: "Owner Goals",
  key_selling_points: "Key Selling Points",
  growth_opportunities: "Growth Opportunities",
  technology_systems: "Technology Systems",
  competitive_position: "Competitive Position",
  key_risks: "Key Risks",
  number_of_locations: "Number of Locations",
};

const getFieldLabel = (field: string): string => {
  return FIELD_LABELS[field] || field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

interface SingleDealEnrichmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SingleDealEnrichmentResult | null;
  onRetry?: () => void;
}

export const SingleDealEnrichmentDialog = ({
  open,
  onOpenChange,
  result,
  onRetry
}: SingleDealEnrichmentDialogProps) => {
  if (!result) return null;

  const isSuccess = result.success;
  const fieldsUpdated = result.fieldsUpdated || [];
  const scrapeReport = result.scrapeReport;
  const transcriptReport = result.transcriptReport;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Enrichment Complete
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Enrichment Failed
              </>
            )}
          </DialogTitle>
          {result.message && (
            <DialogDescription>{result.message}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Success: Show fields updated */}
          {isSuccess && fieldsUpdated.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Updated {fieldsUpdated.length} fields:
              </div>
              <ScrollArea className="max-h-[200px]">
                <div className="grid gap-1.5">
                  {fieldsUpdated.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{getFieldLabel(field)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Success but no fields updated */}
          {isSuccess && fieldsUpdated.length === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted text-muted-foreground text-sm">
              <FileText className="h-4 w-4" />
              No new fields were extracted. The deal may already be up to date.
            </div>
          )}

          {/* Transcript Report */}
          {transcriptReport && transcriptReport.totalTranscripts > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <span className="font-medium">
                  Processed {transcriptReport.processed} of {transcriptReport.totalTranscripts} transcripts
                </span>
                {transcriptReport.errors.length > 0 && (
                  <span className="text-destructive ml-1">
                    ({transcriptReport.errors.length} errors)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Scrape Report */}
          {scrapeReport && (
            <div className="flex items-center gap-3 p-3 rounded-lg border text-sm">
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <span className="font-medium">
                  Scraped {scrapeReport.successfulPages} of {scrapeReport.totalPagesAttempted} pages
                </span>
                {scrapeReport.totalCharactersScraped > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({scrapeReport.totalCharactersScraped.toLocaleString()} chars)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {!isSuccess && result.error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-700 dark:text-red-400">
                {result.error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {!isSuccess && onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SingleDealEnrichmentDialog;
