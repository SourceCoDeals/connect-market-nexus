import { useState } from 'react';
import { Phone } from 'lucide-react';
import { PushToDialerModal } from '@/components/remarketing/PushToDialerModal';
import { cn } from '@/lib/utils';

interface ClickToDialPhoneProps {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  entityType?: 'buyer_contacts' | 'contacts' | 'buyers' | 'listings' | 'leads' | 'contact_list';
  entityId?: string;
  /** Optional valuation lead UUID — used for round-trip attribution via PB custom fields */
  valuationLeadId?: string;
  /** Optional listing UUID — used for round-trip attribution via PB custom fields */
  listingId?: string;
  /** Display label — defaults to the phone number */
  label?: string;
  /** If true, show only an icon button */
  iconOnly?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Clickable phone number that opens the Push to PhoneBurner modal
 * to initiate a dial session with account selection.
 */
export function ClickToDialPhone({
  phone,
  name,
  email,
  company,
  entityType,
  entityId,
  valuationLeadId,
  listingId,
  label,
  iconOnly = false,
  className,
  size = 'sm',
}: ClickToDialPhoneProps) {
  const [dialerOpen, setDialerOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialerOpen(true);
  };

  const sizeClasses = {
    xs: 'text-[10px] gap-0.5',
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
  };

  const iconSizes = {
    xs: 'h-2.5 w-2.5',
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
  };

  const dialerEntityType = entityType || 'contacts';
  const contactIds = entityId ? [entityId] : [];

  // ALWAYS pass inline contact details so the edge function can dial
  // immediately without depending on per-table resolvers (which break for
  // sources like valuation_leads). The edge function prefers inline_contacts
  // when present and skips the DB lookup entirely.
  // Forward valuation_lead_id / listing_id so the push function can stamp
  // them as PhoneBurner custom fields — the webhook reads them back to
  // attribute the call to the correct lead/listing.
  const inlineContacts = [
    {
      phone,
      name,
      email,
      company,
      valuation_lead_id: valuationLeadId,
      listing_id: listingId,
    },
  ];

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={handleClick}
          title={`Call ${phone}`}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1 text-green-700 hover:bg-green-50 transition-colors',
            className,
          )}
        >
          <Phone className={iconSizes[size]} />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          title={`Call ${phone} via PhoneBurner`}
          className={cn(
            'inline-flex items-center font-medium text-green-700 hover:text-green-900 transition-colors',
            sizeClasses[size],
            className,
          )}
        >
          <Phone className={iconSizes[size]} />
          {label ?? phone}
        </button>
      )}

      <PushToDialerModal
        open={dialerOpen}
        onOpenChange={setDialerOpen}
        contactIds={contactIds}
        contactCount={1}
        entityType={dialerEntityType}
        inlineContacts={inlineContacts}
      />
    </>
  );
}
