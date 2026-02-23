import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, Pencil, AlertTriangle } from "lucide-react";
import { formatCurrency } from "./helpers";

interface FinancialOverviewCardProps {
  deal: any;
  onEditClick: () => void;
}

export function FinancialOverviewCard({ deal, onEditClick }: FinancialOverviewCardProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Overview
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditClick}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {((deal.revenue_confidence === 'low') || (deal.ebitda_confidence === 'low')) && (
          <div className="flex items-start gap-2 p-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Needs Clarification</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <FinancialMetric
            label="REVENUE"
            value={deal.revenue}
            confidence={deal.revenue_confidence}
            sourceQuote={deal.revenue_source_quote}
            isInferred={deal.revenue_is_inferred}
            extractionSources={deal.extraction_sources}
            sourceKey="revenue"
          />
          <FinancialMetric
            label="EBITDA"
            value={deal.ebitda}
            confidence={deal.ebitda_confidence}
            sourceQuote={deal.ebitda_source_quote}
            isInferred={deal.ebitda_is_inferred}
            extractionSources={deal.extraction_sources}
            sourceKey="ebitda"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              EBITDA MARGIN
            </p>
            {deal.revenue && deal.ebitda ? (
              <>
                <span className="text-2xl font-bold">
                  {((deal.ebitda / deal.revenue) * 100).toFixed(0)}%
                </span>
                <Progress
                  value={Math.min((deal.ebitda / deal.revenue) * 100, 100)}
                  className="h-2 mt-2"
                />
              </>
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{"\u2013"}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialMetric({
  label, value, confidence, sourceQuote, isInferred, extractionSources, sourceKey,
}: {
  label: string;
  value: number | null;
  confidence: string | null;
  sourceQuote: string | null;
  isInferred: boolean | null;
  extractionSources: Record<string, any> | null;
  sourceKey: string;
}) {
  const sources = extractionSources as Record<string, any> | null;
  const source = sources?.[sourceKey];
  const sourceType = source?.source as string | undefined;
  const transcriptTitle = source?.transcriptTitle as string | undefined;
  const hasQuote = !!sourceQuote;
  const isManual = sourceType === 'manual';
  const isTranscript = sourceType === 'transcript';
  const showPopover = hasQuote || isManual || isTranscript;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {value && (
          <Badge
            variant="outline"
            className={
              confidence === 'high'
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                : confidence === 'low'
                ? "bg-red-50 text-red-600 border-red-200 text-xs"
                : "bg-amber-50 text-amber-700 border-amber-200 text-xs"
            }
          >
            {confidence === 'high' ? '\u2713' : confidence === 'low' ? '\u25B3' : '\u25CB'}
          </Badge>
        )}
      </div>
      <span className="text-2xl font-bold">{formatCurrency(value)}</span>
      {showPopover && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto mt-1 block">
              {isManual ? 'Manually entered' : 'View source'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={
                  isManual ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                  : isTranscript ? "bg-purple-50 text-purple-700 border-purple-200 text-xs"
                  : "bg-gray-50 text-gray-600 border-gray-200 text-xs"
                }>
                  {isManual ? 'Manual' : isTranscript ? 'Transcript' : sourceType || 'Unknown'}
                </Badge>
                {source?.timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(source.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
              {isTranscript && transcriptTitle && (
                <p className="text-xs text-muted-foreground">
                  From: <span className="font-medium text-foreground">{transcriptTitle}</span>
                </p>
              )}
              {hasQuote && (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Source Quote</p>
                  <p className="text-sm italic border-l-2 border-primary/30 pl-2">"{sourceQuote}"</p>
                </>
              )}
              {isManual && !hasQuote && (
                <p className="text-xs text-muted-foreground">Value was entered manually by a team member.</p>
              )}
              {isInferred && (
                <p className="text-xs text-amber-600">Inferred from other financial data</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
