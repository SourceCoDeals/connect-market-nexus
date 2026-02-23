/**
 * Reusable MFA gate component.
 *
 * Wraps protected content (e.g. data room) behind an MFA verification step.
 * If the user has MFA enrolled but the current session is AAL1, they must
 * verify before seeing children. If MFA is not enrolled, children render
 * immediately (MFA is opt-in, enforced only when enrolled).
 */

import { useState } from 'react';
import { useMFAChallengeRequired } from '@/hooks/use-mfa';
import { MFAChallenge } from '@/components/auth/MFAChallenge';
import { Loader2 } from 'lucide-react';

interface MFAGateProps {
  children: React.ReactNode;
  /** Text shown while checking MFA status. */
  loadingText?: string;
}

export function MFAGate({ children, loadingText = 'Verifying security...' }: MFAGateProps) {
  const { needsChallenge, isChecking } = useMFAChallengeRequired();
  const [verified, setVerified] = useState(false);

  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">{loadingText}</p>
      </div>
    );
  }

  if (needsChallenge && !verified) {
    return (
      <MFAChallenge
        onVerified={() => setVerified(true)}
        onCancel={() => {
          // Navigate back; the parent page will handle unmounting
          window.history.back();
        }}
      />
    );
  }

  return <>{children}</>;
}
