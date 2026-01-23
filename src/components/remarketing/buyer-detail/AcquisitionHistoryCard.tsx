import { History, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AcquisitionHistoryCardProps {
  totalAcquisitions?: number | null;
  acquisitionFrequency?: string | null;
  onEdit: () => void;
}

export const AcquisitionHistoryCard = ({
  totalAcquisitions,
  acquisitionFrequency,
  onEdit,
}: AcquisitionHistoryCardProps) => {
  const hasContent = totalAcquisitions !== null || acquisitionFrequency;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="h-4 w-4" />
            Platform Acquisition History
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasContent ? (
          <p className="text-sm text-muted-foreground italic">No acquisition history available</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Total Platform Add-ons
              </p>
              <p className="text-lg font-semibold">
                {totalAcquisitions !== null && totalAcquisitions !== undefined 
                  ? totalAcquisitions 
                  : "—"}
              </p>
            </div>
            {acquisitionFrequency && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Acquisition Frequency
                </p>
                <p className="text-sm">{acquisitionFrequency}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
