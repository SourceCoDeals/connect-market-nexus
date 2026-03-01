import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface PushToSmartleadButtonProps {
  count: number;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default' | 'ghost';
}

/**
 * Reusable "Push to Smartlead" button for any toolbar.
 * Pair with usePushToSmartleadDialog() hook and PushToOutreachModal.
 */
export function PushToSmartleadButton({
  count,
  onClick,
  disabled = false,
  size = 'sm',
  variant = 'outline',
}: PushToSmartleadButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || count === 0}
      className="gap-1"
    >
      <Mail className="h-4 w-4" />
      Push to Smartlead{count > 0 ? ` (${count})` : ''}
    </Button>
  );
}
