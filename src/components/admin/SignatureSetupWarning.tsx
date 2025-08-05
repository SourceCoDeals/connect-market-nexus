import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignatureSetupWarningProps {
  isIncomplete: boolean;
  onEdit: () => void;
}

export function SignatureSetupWarning({ isIncomplete, onEdit }: SignatureSetupWarningProps) {
  if (!isIncomplete) return null;

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Your email signature is incomplete. Complete it to ensure professional emails.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="border-amber-300 text-amber-800 hover:bg-amber-100"
        >
          <Edit3 className="h-3 w-3 mr-1" />
          Complete
        </Button>
      </AlertDescription>
    </Alert>
  );
}