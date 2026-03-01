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
    case 'pending':
      return { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
    case 'approved':
      return { backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' };
    case 'rejected':
      return { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' };
    case 'on_hold':
      return { backgroundColor: '#F59E0B20', color: '#92400E' };
    default:
      return { backgroundColor: '#E8E8E8', color: '#5A5A5A' };
  }
}

// ─── Status display label ───

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Under Review';
    case 'approved':
      return 'Connected';
    case 'rejected':
      return 'Not Selected';
    case 'on_hold':
      return 'On Hold';
    default:
      return status;
  }
}
