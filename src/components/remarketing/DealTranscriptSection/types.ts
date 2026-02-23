import type { SingleDealEnrichmentResult } from "../SingleDealEnrichmentDialog";

export interface DealTranscript {
  id: string;
  listing_id: string;
  transcript_text: string;
  source: string | null;
  extracted_data: unknown;
  applied_to_deal: boolean | null;
  applied_at: string | null;
  processed_at: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  title?: string | null;
  transcript_url?: string | null;
  call_date?: string | null;
}

export interface DealTranscriptSectionProps {
  dealId: string;
  transcripts: DealTranscript[];
  isLoading: boolean;
  dealInfo?: {
    company_name?: string;
    industry?: string;
    location?: string;
    revenue?: number;
    ebitda?: number;
    main_contact_email?: string;
  };
  /** Fireflies sync props */
  contactEmail?: string | null;
  contactName?: string | null;
  companyName?: string;
  onSyncComplete?: () => void;
  onTranscriptLinked?: () => void;
}

export type { SingleDealEnrichmentResult };
