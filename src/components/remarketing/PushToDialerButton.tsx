import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface PushToDialerButtonProps {
  count: number;
  onClick: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}

/**
 * Reusable "Push to Dialer" button for any toolbar.
 * Pair with usePushToDialer() hook and PushToDialerModal.
 */
export function PushToDialerButton({
  count,
  onClick,
  disabled = false,
  size = "sm",
  variant = "outline",
}: PushToDialerButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || count === 0}
      className="gap-1"
    >
      <Phone className="h-4 w-4" />
      Push to Dialer{count > 0 ? ` (${count})` : ""}
    </Button>
  );
}
