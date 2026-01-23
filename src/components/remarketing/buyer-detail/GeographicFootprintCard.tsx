import { Globe, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GeographicFootprintCardProps {
  targetGeographies?: string[] | null;
  onEdit: () => void;
}

export const GeographicFootprintCard = ({
  targetGeographies,
  onEdit,
}: GeographicFootprintCardProps) => {
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
      <CardContent>
        {!targetGeographies || targetGeographies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No geographic preferences specified</p>
        ) : (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Target Geographies
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
      </CardContent>
    </Card>
  );
};
