export interface ListingConversation {
  id: string;
  listing_id: string;
  connection_request_id: string;
  user_id: string;
  admin_id: string | null;
  status: 'active' | 'archived' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface ListingMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'buyer' | 'admin';
  message_text: string;
  is_internal_note: boolean;
  read_at: string | null;
  attachments: any[];
  created_at: string;
  sender?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}
