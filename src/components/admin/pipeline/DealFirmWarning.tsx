import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnectionRequestFirm } from '@/hooks/admin/use-connection-request-firm';

interface DealFirmWarningProps {
  connectionRequestId: string | null;
  actionType: 'fee_agreement' | 'nda';
}

export function DealFirmWarning({ connectionRequestId, actionType }: DealFirmWarningProps) {
  const { data: firmInfo, isLoading } = useConnectionRequestFirm(connectionRequestId);

  if (isLoading || !firmInfo || !firmInfo.firm_id) {
    return null;
  }

  const memberCount = firmInfo.member_count || 0;
  const documentType = actionType === 'fee_agreement' ? 'Fee Agreement' : 'NDA';

  return (
    <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
        <span className="font-semibold">{firmInfo.firm_name}</span> has{' '}
        <span className="font-semibold">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>.
        Updating the {documentType} status will cascade to all firm members.
      </AlertDescription>
    </Alert>
  );
}
