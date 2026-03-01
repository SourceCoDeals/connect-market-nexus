/**
 * SingleContactTimeline.tsx
 *
 * Shows the activity timeline for a single contact,
 * using either buyerId or email to look up history.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import { Phone } from 'lucide-react';
import {
  ContactActivityTimeline,
  ContactActivityTimelineByEmail,
} from '@/components/remarketing/ContactActivityTimeline';

interface SingleContactTimelineProps {
  tab: {
    buyerId?: string | null;
    email?: string | null;
    label: string;
  };
}

export function SingleContactTimeline({ tab }: SingleContactTimelineProps) {
  if (tab.buyerId) {
    return (
      <ContactActivityTimeline
        buyerId={tab.buyerId}
        title={`${tab.label} - Activity`}
        maxHeight={600}
        compact
      />
    );
  }

  if (tab.email) {
    return (
      <ContactActivityTimelineByEmail
        email={tab.email}
        title={`${tab.label} - Activity`}
        maxHeight={600}
        compact
      />
    );
  }

  return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      <Phone className="h-6 w-6 mx-auto mb-2 opacity-40" />
      No email address on file — cannot look up communication history
    </div>
  );
}
