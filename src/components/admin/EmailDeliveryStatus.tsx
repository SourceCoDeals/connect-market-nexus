import { CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmailDeliveryMonitoring } from "@/hooks/admin/use-email-delivery-monitoring";

interface EmailDeliveryStatusProps {
  correlationId: string;
  onRetry?: () => void;
}

export function EmailDeliveryStatus({ correlationId, onRetry }: EmailDeliveryStatusProps) {
  const { getEmailStatus } = useEmailDeliveryMonitoring();
  const status = getEmailStatus(correlationId);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-sm">Email pending...</span>
      </div>
    );
  }

  if (status.success) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <Badge variant="secondary" className="text-green-700 bg-green-50">
          Email sent successfully
        </Badge>
        {status.messageId && (
          <span className="text-xs text-muted-foreground">
            ID: {status.messageId.substring(0, 8)}...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <AlertCircle className="h-4 w-4 text-red-500" />
      <Badge variant="destructive">
        Email failed
      </Badge>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="h-6 px-2"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
      {status.error && (
        <span className="text-xs text-muted-foreground max-w-xs truncate">
          {status.error}
        </span>
      )}
    </div>
  );
}