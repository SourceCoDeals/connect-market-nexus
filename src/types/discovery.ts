/**
 * Company Discovery Types
 *
 * Types for AI-powered company discovery using Google search (via Apify)
 * and Claude Haiku for result parsing.
 */

export interface GoogleSearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface CompanyDiscoveryRequest {
  query: string;
  industry?: string;
  geography?: string;
  min_locations?: number;
  max_results?: number;
}

export interface DiscoveredCompany {
  name: string;
  url: string;
  description: string;
  industry?: string;
  location?: string;
  estimated_size?: string;
  already_in_db: boolean;
  existing_buyer_id?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CompanyDiscoveryResult {
  companies: DiscoveredCompany[];
  total_found: number;
  query_used: string;
  search_duration_ms: number;
  errors?: string[];
}
