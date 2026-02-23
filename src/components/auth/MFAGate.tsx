/**
 * MFAGate — Requires MFA verification before rendering protected content.
 *
 * Used for sensitive non-admin actions like data room access and NDA signing.
 * If the user has MFA enrolled but hasn't verified in this session,
 * shows the MFA challenge. If MFA is not enrolled, shows content directly
 * (enrollment is optional for marketplace users).
 *
 * Usage:
 *   <MFAGate description="Access the data room">
 *     <BuyerDataRoom dealId={dealId} />
 *   </MFAGate>
 */

import { useState } from 'react';
import { useMFAChallengeRequired } from '@/hooks/use-mfa';
import { MFAChallenge } from '@/components/auth/MFAChallenge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

interface MFAGateProps {
  children: React.ReactNode;
  /** Description of what the user is trying to access */
  description?: string;
}

export function MFAGate({ children, description = 'access this content' }: MFAGateProps) {
  const { needsChallenge, isChecking } = useMFAChallengeRequired();
  const [mfaVerified, setMfaVerified] = useState(false);

  // While checking MFA status, show a spinner
  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Verifying security...</span>
      </div>
    );
  }

  // If user has MFA enrolled but hasn't verified yet
  if (needsChallenge && !mfaVerified) {
    return (
      <Card className="max-w-md mx-auto mt-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-lg">Verification Required</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-factor authentication is required to {description}.
          </p>
        </CardHeader>
        <CardContent>
          <MFAChallenge
            onVerified={() => setMfaVerified(true)}
            onCancel={() => {
              // User cancelled — stay on page but don't show content
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // MFA not enrolled (optional for buyers) or already verified — show content
  return <>{children}</>;
}
