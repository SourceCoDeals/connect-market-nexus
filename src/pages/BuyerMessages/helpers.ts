// ─── Types ───

export interface BuyerThread {
  connection_request_id: string;
  deal_title: string;
  deal_category?: string;
  request_status: string;
  listing_id: string;
  last_message_body: string;
  last_message_at: string;
  last_sender_role: string;
  unread_count: number;
}

// ─── Status style mapping ───

export function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'approved':
      return { backgroundColor: '#DEC76B', color: '#0E101A' };
    case 'pending':
      return { backgroundColor: '#F7F4DD', color: '#5A5A5A', border: '1px solid #DEC76B' };
    case 'rejected':
      return { backgroundColor: '#8B0000', color: '#FFFFFF' };
    case 'on_hold':
      return { backgroundColor: '#F59E0B20', color: '#92400E' };
    default:
      return { backgroundColor: '#E8E8E8', color: '#5A5A5A' };
  }
}

// ─── Status display label ───

export function getStatusLabel(status: string): string {
  return status === 'on_hold' ? 'On Hold' : status;
}
