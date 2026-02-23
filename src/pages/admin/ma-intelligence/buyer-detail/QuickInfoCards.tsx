import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuickInfoCardsProps } from "./types";

export function QuickInfoCards({ buyer }: QuickInfoCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {buyer.hq_city && buyer.hq_state
              ? `${buyer.hq_city}, ${buyer.hq_state}`
              : buyer.hq_state || "\u2014"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Revenue Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {buyer.min_revenue || buyer.max_revenue
              ? `$${buyer.min_revenue || 0}M - $${buyer.max_revenue || "\u221E"}M`
              : "\u2014"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">EBITDA Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {buyer.min_ebitda || buyer.max_ebitda
              ? `$${buyer.min_ebitda || 0}M - $${buyer.max_ebitda || "\u221E"}M`
              : "\u2014"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Acquisitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {buyer.total_acquisitions || 0} total
            {buyer.acquisition_frequency && (
              <span className="text-muted-foreground ml-1">
                &bull; {buyer.acquisition_frequency}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
