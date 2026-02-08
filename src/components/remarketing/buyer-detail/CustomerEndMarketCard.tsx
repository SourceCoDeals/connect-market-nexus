import { Users, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CustomerEndMarketCardProps {
  primaryCustomerSize?: string | null;
  customerGeographicReach?: string | null;
  customerIndustries?: string[] | null;
  targetCustomerProfile?: string | null;
  onEdit: () => void;
  className?: string;
}

export const CustomerEndMarketCard = ({
  primaryCustomerSize,
  customerGeographicReach,
  customerIndustries,
  targetCustomerProfile,
  onEdit,
  className,
}: CustomerEndMarketCardProps) => {
  const hasContent = primaryCustomerSize || customerGeographicReach || customerIndustries?.length || targetCustomerProfile;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" />
            Customer / End Market Info
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No customer information available</p>
        ) : (
          <>
            {/* Size and Reach */}
            {(primaryCustomerSize || customerGeographicReach) && (
              <div className="grid grid-cols-2 gap-4">
                {primaryCustomerSize && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Primary Customer Size
                    </p>
                    <p className="text-sm font-medium">{primaryCustomerSize}</p>
                  </div>
                )}
                {customerGeographicReach && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Customer Geographic Reach
                    </p>
                    <p className="text-sm">{customerGeographicReach}</p>
                  </div>
                )}
              </div>
            )}

            {/* Customer Industries */}
            {customerIndustries && customerIndustries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Customer Industries
                </p>
                <div className="flex flex-wrap gap-2">
                  {customerIndustries.map((industry, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Target Customer Profile */}
            {targetCustomerProfile && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Target Customer Profile
                </p>
                <p className="text-sm">{targetCustomerProfile}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
