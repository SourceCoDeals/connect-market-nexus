import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Info } from "lucide-react";
import type { DealContextBannerProps } from "./types";

export function DealContextBanner({
  dealId,
  onApprove,
  onPass,
}: DealContextBannerProps) {
  if (!dealId) return null;

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Viewing in deal context</span>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onApprove}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Approve for this Deal
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onPass}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Pass on this Deal
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
