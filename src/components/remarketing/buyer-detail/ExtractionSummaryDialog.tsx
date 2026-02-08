import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, FileText, MapPin, Target, Briefcase, TrendingUp, Quote } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ExtractionResult {
  thesis_summary?: string;
  thesis_confidence?: string;
  strategic_priorities?: string[];
  target_industries?: string[];
  target_geography?: { regions?: string[]; states?: string[]; notes?: string };
  deal_size_range?: { revenue_min?: number; revenue_max?: number; ebitda_min?: number; ebitda_max?: number; notes?: string };
  acquisition_timeline?: string;
  services_offered?: string[];
  business_summary?: string;
  operating_locations?: string[];
  geographic_footprint?: string[];
  missing_information?: string[];
}

interface ExtractionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: Array<{
    fileName?: string;
    insights?: ExtractionResult;
    error?: string;
  }>;
  totalCount: number;
  successCount: number;
  errorCount: number;
}

const confidenceBadge = (confidence?: string) => {
  if (!confidence) return null;
  const variants: Record<string, string> = {
    high: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    low: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    insufficient: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={variants[confidence] || ""}>
      {confidence}
    </Badge>
  );
};

const formatCurrency = (val?: number) => {
  if (!val) return null;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
};

const Section = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="text-sm pl-5.5">{children}</div>
  </div>
);

export function ExtractionSummaryDialog({
  open,
  onOpenChange,
  results,
  totalCount,
  successCount,
  errorCount,
}: ExtractionSummaryDialogProps) {
  // Merge all successful insights into a combined view
  const merged: ExtractionResult = {};
  for (const r of results) {
    if (!r.insights) continue;
    const ins = r.insights;
    if (ins.thesis_summary && !merged.thesis_summary) merged.thesis_summary = ins.thesis_summary;
    if (ins.thesis_confidence && (!merged.thesis_confidence || ins.thesis_confidence !== 'insufficient')) {
      merged.thesis_confidence = ins.thesis_confidence;
    }
    if (ins.business_summary && !merged.business_summary) merged.business_summary = ins.business_summary;
    if (ins.acquisition_timeline && ins.acquisition_timeline !== 'insufficient') {
      merged.acquisition_timeline = ins.acquisition_timeline;
    }
    // Merge arrays
    for (const key of ['strategic_priorities', 'target_industries', 'services_offered', 'operating_locations', 'geographic_footprint', 'missing_information'] as const) {
      if (ins[key]?.length) {
        merged[key] = [...new Set([...(merged[key] || []), ...ins[key]!])];
      }
    }
    if (ins.target_geography?.states?.length) {
      merged.target_geography = {
        ...merged.target_geography,
        states: [...new Set([...(merged.target_geography?.states || []), ...ins.target_geography.states])],
        regions: [...new Set([...(merged.target_geography?.regions || []), ...(ins.target_geography.regions || [])])],
      };
    }
    if (ins.deal_size_range) {
      merged.deal_size_range = { ...merged.deal_size_range, ...ins.deal_size_range };
    }
  }

  const hasData = merged.thesis_summary || merged.business_summary || merged.strategic_priorities?.length ||
    merged.target_industries?.length || merged.services_offered?.length || merged.geographic_footprint?.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {errorCount === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            Extraction Complete
          </DialogTitle>
          <DialogDescription>
            {successCount} of {totalCount} transcript{totalCount !== 1 ? 's' : ''} processed
            {errorCount > 0 && ` · ${errorCount} failed`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {hasData ? (
              <>
                {/* Thesis */}
                {merged.thesis_summary && (
                  <Section icon={FileText} label="Acquisition Thesis">
                    <p>{merged.thesis_summary}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      {confidenceBadge(merged.thesis_confidence)}
                    </div>
                  </Section>
                )}

                {/* Business Summary */}
                {merged.business_summary && (
                  <Section icon={Briefcase} label="Business Summary">
                    <p>{merged.business_summary}</p>
                  </Section>
                )}

                <Separator />

                {/* Strategic Priorities */}
                {merged.strategic_priorities?.length ? (
                  <Section icon={Target} label="Strategic Priorities">
                    <ul className="list-disc pl-4 space-y-0.5">
                      {merged.strategic_priorities.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </Section>
                ) : null}

                {/* Services */}
                {merged.services_offered?.length ? (
                  <Section icon={Briefcase} label="Services Offered">
                    <div className="flex flex-wrap gap-1.5">
                      {merged.services_offered.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </Section>
                ) : null}

                {/* Target Industries */}
                {merged.target_industries?.length ? (
                  <Section icon={TrendingUp} label="Target Industries">
                    <div className="flex flex-wrap gap-1.5">
                      {merged.target_industries.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </Section>
                ) : null}

                {/* Geography */}
                {(merged.geographic_footprint?.length || merged.operating_locations?.length || merged.target_geography?.states?.length) ? (
                  <Section icon={MapPin} label="Geography">
                    {merged.operating_locations?.length ? (
                      <p><span className="text-muted-foreground">Operations:</span> {merged.operating_locations.join(', ')}</p>
                    ) : null}
                    {merged.geographic_footprint?.length ? (
                      <p><span className="text-muted-foreground">Footprint:</span> {merged.geographic_footprint.join(', ')}</p>
                    ) : null}
                    {merged.target_geography?.states?.length ? (
                      <p><span className="text-muted-foreground">Target states:</span> {merged.target_geography.states.join(', ')}</p>
                    ) : null}
                  </Section>
                ) : null}

                {/* Deal Size */}
                {merged.deal_size_range && (merged.deal_size_range.revenue_min || merged.deal_size_range.ebitda_min) ? (
                  <Section icon={TrendingUp} label="Deal Size Criteria">
                    {(merged.deal_size_range.revenue_min || merged.deal_size_range.revenue_max) && (
                      <p>Revenue: {formatCurrency(merged.deal_size_range.revenue_min)} – {formatCurrency(merged.deal_size_range.revenue_max)}</p>
                    )}
                    {(merged.deal_size_range.ebitda_min || merged.deal_size_range.ebitda_max) && (
                      <p>EBITDA: {formatCurrency(merged.deal_size_range.ebitda_min)} – {formatCurrency(merged.deal_size_range.ebitda_max)}</p>
                    )}
                  </Section>
                ) : null}

                {/* Timeline */}
                {merged.acquisition_timeline && merged.acquisition_timeline !== 'insufficient' && (
                  <Section icon={TrendingUp} label="Timeline">
                    <Badge variant="outline">{merged.acquisition_timeline}</Badge>
                  </Section>
                )}

                <Separator />

                {/* Missing Info */}
                {merged.missing_information?.length ? (
                  <Section icon={AlertTriangle} label="Missing Information">
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      {merged.missing_information.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </Section>
                ) : null}
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="font-medium">No buyer thesis data extracted</p>
                <p className="text-xs mt-1">
                  The transcripts may be target evaluation calls rather than thesis discussions.
                  Check the "Missing Information" notes on each transcript for details.
                </p>
              </div>
            )}

            {/* Per-transcript status */}
            {results.length > 1 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Per-transcript status</p>
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {r.error ? (
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">{r.fileName || `Transcript ${i + 1}`}</span>
                      {r.insights?.thesis_confidence && (
                        <span className="ml-auto">{confidenceBadge(r.insights.thesis_confidence)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}