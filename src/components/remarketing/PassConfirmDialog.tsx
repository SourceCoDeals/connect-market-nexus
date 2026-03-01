import { PassReasonDialog } from './PassReasonDialog';

interface PassConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerName: string;
  onConfirm: (reason: string, category: string, notes?: string) => void;
  isBulk?: boolean;
  bulkCount?: number;
  onBulkConfirm?: (reason: string, category: string, notes?: string) => void;
}

export const PassConfirmDialog = ({
  open,
  onOpenChange,
  buyerName,
  onConfirm,
  isBulk = false,
  bulkCount = 0,
  onBulkConfirm,
}: PassConfirmDialogProps) => {
  const handleConfirm = (reason: string, category: string, notes?: string) => {
    if (isBulk && onBulkConfirm) {
      onBulkConfirm(reason, category, notes);
    } else {
      onConfirm(reason, category, notes);
    }
  };

  const displayName = isBulk
    ? `${bulkCount} selected buyer${bulkCount !== 1 ? 's' : ''}`
    : buyerName;

  return (
    <PassReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      buyerName={displayName}
      onConfirm={handleConfirm}
    />
  );
};

export default PassConfirmDialog;
