export interface NonMarketplaceUser {
  id: string; // synthetic ID: source_type:source_id
  email: string;
  name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  source: 'connection_request' | 'inbound_lead' | 'deal';
  source_id: string; // original record ID
  firm_id: string | null;
  firm_name: string | null;
  created_at: string;
  
  // Aggregated metadata
  connection_requests_count: number;
  inbound_leads_count: number;
  deals_count: number;
  
  // Status tracking
  nda_status: string | null;
  fee_agreement_status: string | null;
  
  // Potential profile match
  potential_profile_id: string | null;
  potential_profile_name: string | null;
  
  // All associated records
  associated_records: {
    connection_requests: any[];
    inbound_leads: any[];
    deals: any[];
  };
}

export interface NonMarketplaceUserFilters {
  searchQuery?: string;
  sourceFilter?: 'all' | 'connection_request' | 'inbound_lead' | 'deal';
  firmFilter?: string;
  hasProfileMatch?: boolean;
}
