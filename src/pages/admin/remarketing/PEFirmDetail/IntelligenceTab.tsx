import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";

interface IntelligenceTabProps {
  firm: {
    notes: string | null;
    thesis_summary: string | null;
    target_industries: string[] | null;
    target_revenue_min: number | null;
    target_revenue_max: number | null;
    target_ebitda_min: number | null;
    target_ebitda_max: number | null;
    acquisition_appetite: string | null;
    acquisition_timeline: string | null;
    target_geographies: string[] | null;
  };
  onUpdateFirm: (data: Record<string, unknown>) => void;
  onUpdateFirmAsync: (data: Record<string, unknown>) => Promise<unknown>;
}

export const IntelligenceTab = ({
  firm,
  onUpdateFirm,
  onUpdateFirmAsync,
}: IntelligenceTabProps) => {
  return (
    <div className="space-y-4">
      <BuyerNotesSection
        notes={firm.notes || null}
        onSave={async (notes) => {
          await onUpdateFirmAsync({ notes });
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Investment Strategy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investment Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            {firm.thesis_summary ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {firm.thesis_summary}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No investment strategy documented yet. Add from call transcripts or
                manually.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                const strategy = prompt(
                  "Investment Strategy:",
                  firm.thesis_summary || ""
                );
                if (strategy !== null) {
                  onUpdateFirm({ thesis_summary: strategy });
                }
              }}
            >
              Edit Strategy
            </Button>
          </CardContent>
        </Card>

        {/* Target Industries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target Industries</CardTitle>
          </CardHeader>
          <CardContent>
            {(firm.target_industries?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {firm.target_industries!.map((ind: string) => (
                  <Badge key={ind} variant="secondary" className="text-xs">
                    {ind}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No target industries documented yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Deal Structure Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deal Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Revenue Range:</span>
                <p className="font-medium">
                  {firm.target_revenue_min || firm.target_revenue_max
                    ? `$${(firm.target_revenue_min ? (firm.target_revenue_min / 1000000).toFixed(1) : "?")}M \u2013 $${(firm.target_revenue_max ? (firm.target_revenue_max / 1000000).toFixed(1) : "?")}M`
                    : "Not specified"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">EBITDA Range:</span>
                <p className="font-medium">
                  {firm.target_ebitda_min || firm.target_ebitda_max
                    ? `$${(firm.target_ebitda_min ? (firm.target_ebitda_min / 1000000).toFixed(1) : "?")}M \u2013 $${(firm.target_ebitda_max ? (firm.target_ebitda_max / 1000000).toFixed(1) : "?")}M`
                    : "Not specified"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Acquisition Appetite:</span>
                <p className="font-medium">{firm.acquisition_appetite || "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Timeline:</span>
                <p className="font-medium">{firm.acquisition_timeline || "Not specified"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Focus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geographic Focus</CardTitle>
          </CardHeader>
          <CardContent>
            {(firm.target_geographies?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {firm.target_geographies!.map((geo: string) => (
                  <Badge key={geo} variant="secondary" className="text-xs">
                    {geo}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No geographic preferences documented yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
