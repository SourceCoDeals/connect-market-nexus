import { Globe, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GeographicFootprintCardProps {
  targetGeographies?: string[] | null;
  operatingLocations?: string[] | null;
  onEdit: () => void;
}

export const GeographicFootprintCard = ({
  targetGeographies,
  operatingLocations,
  onEdit,
}: GeographicFootprintCardProps) => {
  // Group operating locations by state
  const locationsByState = operatingLocations?.reduce((acc, loc) => {
    const parts = loc.split(", ");
    const state = parts[parts.length - 1] || "Other";
    if (!acc[state]) acc[state] = [];
    acc[state].push(parts.slice(0, -1).join(", ") || loc);
    return acc;
  }, {} as Record<string, string[]>);

  const hasLocations = operatingLocations && operatingLocations.length > 0;
  const hasTargetGeos = targetGeographies && targetGeographies.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Globe className="h-4 w-4" />
            Geographic Footprint
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Operating Locations (City, State pairs) */}
        {hasLocations && locationsByState && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Operating Locations ({operatingLocations.length})
            </p>
            <div className="space-y-2">
              {Object.entries(locationsByState).map(([state, cities]) => (
                <div key={state} className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {state} ({cities.length})
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {cities.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target Geographies (State codes) */}
        {hasTargetGeos && (
          <div className={hasLocations ? "pt-3 border-t" : ""}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Target Acquisition Geographies
            </p>
            <div className="flex flex-wrap gap-2">
              {targetGeographies.map((geo, index) => (
                <Badge 
                  key={index} 
                  variant="outline"
                  className="text-sm"
                >
                  {geo}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasLocations && !hasTargetGeos && (
          <p className="text-sm text-muted-foreground italic">No geographic preferences specified</p>
        )}
      </CardContent>
    </Card>
  );
};
