/**
 * NDASection.tsx
 *
 * Agreements sidebar card showing NDA and Fee Agreement statuses
 * with send buttons.
 */
import { SidebarCard } from './SidebarCard';

interface NDASectionProps {
  hasNDA: boolean;
  hasFeeAgreement: boolean;
  ndaStatus: string;
  feeStatus: string;
  firmId?: string;
  onSendAgreement: (type: 'nda' | 'fee_agreement') => void;
}

export function NDASection({
  hasNDA,
  hasFeeAgreement,
  ndaStatus,
  feeStatus,
  firmId,
  onSendAgreement,
}: NDASectionProps) {
  return (
    <SidebarCard title="Agreements">
      <div className="space-y-0">
        <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-b-0">
          <span className="text-base text-muted-foreground font-medium">NDA</span>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${hasNDA ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span className="text-base font-semibold text-foreground">
              {hasNDA ? 'Signed' : ndaStatus === 'sent' ? 'Sent' : 'Not Sent'}
            </span>
            {!hasNDA && firmId && (
              <button
                onClick={() => onSendAgreement('nda')}
                className="text-sm font-bold text-sourceco-foreground bg-sourceco border border-sourceco rounded-md px-3 py-1 hover:bg-sourceco/90 transition-colors shadow-sm"
              >
                ↗ Send
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-base text-muted-foreground font-medium">Fee Agreement</span>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${hasFeeAgreement ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span className="text-base font-semibold text-foreground">
              {hasFeeAgreement ? 'Signed' : feeStatus === 'sent' ? 'Sent' : 'Not Sent'}
            </span>
            {!hasFeeAgreement && firmId && (
              <button
                onClick={() => onSendAgreement('fee_agreement')}
                className="text-sm font-bold text-sourceco-foreground bg-sourceco border border-sourceco rounded-md px-3 py-1 hover:bg-sourceco/90 transition-colors shadow-sm"
              >
                ↗ Send
              </button>
            )}
          </div>
        </div>
      </div>
    </SidebarCard>
  );
}
