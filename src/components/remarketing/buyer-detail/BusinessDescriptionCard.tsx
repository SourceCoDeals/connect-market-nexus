import { Building2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BusinessDescriptionCardProps {
  industryVertical?: string | null;
  businessSummary?: string | null;
  servicesOffered?: string[] | null;
  specializedFocus?: string | null;
  onEdit: () => void;
}

export const BusinessDescriptionCard = ({
  industryVertical,
  businessSummary,
  servicesOffered,
  specializedFocus,
  onEdit,
}: BusinessDescriptionCardProps) => {
  const hasContent = industryVertical || businessSummary || servicesOffered?.length || specializedFocus;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="h-4 w-4" />
            Business Description
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No business description available</p>
        ) : (
          <>
            {industryVertical && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Industry Vertical
                </p>
                <p className="text-sm">{industryVertical}</p>
              </div>
            )}

            {businessSummary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Business Summary
                </p>
                <p className="text-sm">{businessSummary}</p>
              </div>
            )}

            {servicesOffered && servicesOffered.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Services Offered
                </p>
                <p className="text-sm">{servicesOffered.join(", ")}</p>
              </div>
            )}

            {specializedFocus && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Specialized Focus
                </p>
                <p className="text-sm">{specializedFocus}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
