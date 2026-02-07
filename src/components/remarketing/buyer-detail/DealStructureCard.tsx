import { DollarSign, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DealStructureCardProps {
  minRevenue?: number | null;
  maxRevenue?: number | null;
  revenueSweetSpot?: number | null;
  minEbitda?: number | null;
  maxEbitda?: number | null;
  ebitdaSweetSpot?: number | null;
  dealPreferences?: string | null;
  acquisitionAppetite?: string | null;
  acquisitionTimeline?: string | null;
  onEdit: () => void;
  className?: string;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
};

export const DealStructureCard = ({
  minRevenue,
  maxRevenue,
  revenueSweetSpot,
  minEbitda,
  maxEbitda,
  ebitdaSweetSpot,
  dealPreferences,
  acquisitionAppetite,
  acquisitionTimeline,
  onEdit,
  className,
}: DealStructureCardProps) => {
  const hasRevenue = minRevenue || maxRevenue || revenueSweetSpot;
  const hasEbitda = minEbitda || maxEbitda || ebitdaSweetSpot;
  const hasContent = hasRevenue || hasEbitda || dealPreferences || acquisitionAppetite || acquisitionTimeline;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <DollarSign className="h-4 w-4" />
            Deal Structure
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No deal structure criteria available</p>
        ) : (
          <>
            {/* Size Criteria */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Size Criteria
              </p>
              
              {/* Revenue Row */}
              {hasRevenue && (
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MIN REVENUE</p>
                    <p className="font-medium">{formatCurrency(minRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MAX REVENUE</p>
                    <p className="font-medium">{formatCurrency(maxRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">REVENUE SWEET SPOT</p>
                    <p className="font-medium">{formatCurrency(revenueSweetSpot)}</p>
                  </div>
                </div>
              )}

              {/* EBITDA Row */}
              {hasEbitda && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MIN EBITDA</p>
                    <p className="font-medium">{formatCurrency(minEbitda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">MAX EBITDA</p>
                    <p className="font-medium">{formatCurrency(maxEbitda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">EBITDA SWEET SPOT</p>
                    <p className="font-medium">{formatCurrency(ebitdaSweetSpot)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Deal Preferences */}
            {dealPreferences && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Deal Preferences
                </p>
                <p className="text-sm">{dealPreferences}</p>
              </div>
            )}

            {/* Acquisition Appetite */}
            {(acquisitionAppetite || acquisitionTimeline) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Acquisition Appetite
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {acquisitionAppetite && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">CURRENT APPETITE</p>
                      <p className="text-sm">{acquisitionAppetite}</p>
                    </div>
                  )}
                  {acquisitionTimeline && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ACQUISITION TIMELINE</p>
                      <p className="text-sm">{acquisitionTimeline}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
