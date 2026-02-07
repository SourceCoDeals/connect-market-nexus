/**
 * AI Chat Tool Definitions and Handlers
 *
 * This module defines tools/functions that can be called by the AI chatbot
 * to retrieve data, search, and perform operations beyond the initial context.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// TOOL DEFINITIONS (for AI model)
// ============================================================================

export const chatTools = [
  {
    type: "function",
    function: {
      name: "search_transcripts",
      description: "Search call transcripts for specific keywords, topics, or questions. Use this when the user asks about specific content from calls or wants to find relevant quotes.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "The deal/listing ID to search transcripts for"
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Keywords or phrases to search for in transcripts (e.g., ['timing', 'Q2', 'close'])"
          },
          ceo_only: {
            type: "boolean",
            description: "If true, only search transcripts where CEO was detected",
            default: false
          }
        },
        required: ["deal_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_buyer_details",
      description: "Retrieve comprehensive details about a specific buyer including full acquisition history, portfolio, and strategic priorities. Use when user asks for detailed information about a specific buyer.",
      parameters: {
        type: "object",
        properties: {
          buyer_id: {
            type: "string",
            description: "The UUID of the buyer to retrieve details for"
          }
        },
        required: ["buyer_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_buyers_by_criteria",
      description: "Dynamically search for buyers matching specific criteria beyond the initial context. Use when user asks for buyers with very specific requirements not easily answered from the loaded context.",
      parameters: {
        type: "object",
        properties: {
          geographies: {
            type: "array",
            items: { type: "string" },
            description: "State codes or regions to filter by (e.g., ['TX', 'CA'])"
          },
          services: {
            type: "array",
            items: { type: "string" },
            description: "Service types to filter by"
          },
          min_revenue: {
            type: "number",
            description: "Minimum target revenue in dollars"
          },
          max_revenue: {
            type: "number",
            description: "Maximum target revenue in dollars"
          },
          buyer_types: {
            type: "array",
            items: { type: "string" },
            description: "Buyer types to filter by (e.g., ['Private Equity', 'Strategic'])"
          },
          has_fee_agreement: {
            type: "boolean",
            description: "Filter buyers with fee agreements"
          },
          min_acquisition_appetite: {
            type: "string",
            description: "Minimum acquisition appetite level"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_score_breakdown",
      description: "Get detailed scoring breakdown and reasoning for a specific buyer-deal match. Use when user wants to understand exactly why a score is what it is.",
      parameters: {
        type: "object",
        properties: {
          buyer_id: {
            type: "string",
            description: "The buyer UUID"
          },
          deal_id: {
            type: "string",
            description: "The deal/listing UUID"
          }
        },
        required: ["buyer_id", "deal_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_contact_details",
      description: "Retrieve full contact list for a buyer, not just the top 2. Use when user specifically asks for all contacts or contact information.",
      parameters: {
        type: "object",
        properties: {
          buyer_id: {
            type: "string",
            description: "The buyer UUID"
          }
        },
        required: ["buyer_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_acquisition_history",
      description: "Retrieve detailed acquisition history for a buyer including recent deals, patterns, and trends.",
      parameters: {
        type: "object",
        properties: {
          buyer_id: {
            type: "string",
            description: "The buyer UUID"
          },
          limit: {
            type: "number",
            description: "Maximum number of acquisitions to return",
            default: 10
          }
        },
        required: ["buyer_id"]
      }
    }
  }
];

// ============================================================================
// TOOL HANDLERS (implementations)
// ============================================================================

interface TranscriptSearchResult {
  transcript_id: string;
  created_at: string;
  call_type: string;
  ceo_detected: boolean;
  matching_quotes: string[];
  relevant_insights: any;
  transcript_preview: string;
}

export async function searchTranscripts(
  supabase: SupabaseClient,
  args: { deal_id: string; keywords?: string[]; ceo_only?: boolean }
): Promise<{ results: TranscriptSearchResult[]; total: number; error?: string }> {
  try {
    let query = supabase
      .from('call_transcripts')
      .select('id, created_at, call_type, ceo_detected, key_quotes, extracted_insights, transcript_text')
      .eq('listing_id', args.deal_id);

    if (args.ceo_only) {
      query = query.eq('ceo_detected', true);
    }

    query = query.order('created_at', { ascending: false }).limit(10);

    const { data: transcripts, error } = await query;

    if (error) {
      return { results: [], total: 0, error: error.message };
    }

    if (!transcripts || transcripts.length === 0) {
      return { results: [], total: 0 };
    }

    // Filter by keywords if provided
    let filteredTranscripts = transcripts;
    if (args.keywords && args.keywords.length > 0) {
      const keywords = args.keywords.map(k => k.toLowerCase());

      filteredTranscripts = transcripts.filter(t => {
        const searchText = [
          t.transcript_text || '',
          JSON.stringify(t.key_quotes || []),
          JSON.stringify(t.extracted_insights || {})
        ].join(' ').toLowerCase();

        return keywords.some(keyword => searchText.includes(keyword));
      });
    }

    const results: TranscriptSearchResult[] = filteredTranscripts.map(t => ({
      transcript_id: t.id,
      created_at: t.created_at,
      call_type: t.call_type || 'Unknown',
      ceo_detected: t.ceo_detected || false,
      matching_quotes: t.key_quotes || [],
      relevant_insights: t.extracted_insights || {},
      transcript_preview: t.transcript_text ? t.transcript_text.substring(0, 300) + '...' : ''
    }));

    return { results, total: results.length };
  } catch (err) {
    return { results: [], total: 0, error: String(err) };
  }
}

export async function getBuyerDetails(
  supabase: SupabaseClient,
  args: { buyer_id: string }
): Promise<{ buyer: any; error?: string }> {
  try {
    const { data: buyer, error } = await supabase
      .from('remarketing_buyers')
      .select('*')
      .eq('id', args.buyer_id)
      .single();

    if (error) {
      return { buyer: null, error: error.message };
    }

    // Also fetch contacts
    const { data: contacts } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('buyer_id', args.buyer_id)
      .order('is_primary_contact', { ascending: false });

    return {
      buyer: {
        ...buyer,
        contacts: contacts || []
      }
    };
  } catch (err) {
    return { buyer: null, error: String(err) };
  }
}

export async function searchBuyersByCriteria(
  supabase: SupabaseClient,
  args: {
    geographies?: string[];
    services?: string[];
    min_revenue?: number;
    max_revenue?: number;
    buyer_types?: string[];
    has_fee_agreement?: boolean;
    min_acquisition_appetite?: string;
  }
): Promise<{ buyers: any[]; total: number; error?: string }> {
  try {
    let query = supabase
      .from('remarketing_buyers')
      .select('id, company_name, pe_firm_name, buyer_type, geographic_footprint, target_services, target_revenue_min, target_revenue_max, acquisition_appetite, data_completeness')
      .eq('archived', false);

    // Apply filters
    if (args.buyer_types && args.buyer_types.length > 0) {
      query = query.in('buyer_type', args.buyer_types);
    }

    if (args.has_fee_agreement !== undefined) {
      query = query.eq('has_fee_agreement', args.has_fee_agreement);
    }

    query = query.limit(50);

    const { data: buyers, error } = await query;

    if (error) {
      return { buyers: [], total: 0, error: error.message };
    }

    // Post-filter for array and range fields
    let filteredBuyers = buyers || [];

    if (args.geographies && args.geographies.length > 0) {
      filteredBuyers = filteredBuyers.filter(b =>
        b.geographic_footprint &&
        args.geographies!.some(geo => b.geographic_footprint.includes(geo))
      );
    }

    if (args.services && args.services.length > 0) {
      filteredBuyers = filteredBuyers.filter(b =>
        b.target_services &&
        args.services!.some(svc =>
          b.target_services.some((ts: string) => ts.toLowerCase().includes(svc.toLowerCase()))
        )
      );
    }

    if (args.min_revenue !== undefined) {
      filteredBuyers = filteredBuyers.filter(b =>
        b.target_revenue_max === null || b.target_revenue_max >= args.min_revenue!
      );
    }

    if (args.max_revenue !== undefined) {
      filteredBuyers = filteredBuyers.filter(b =>
        b.target_revenue_min === null || b.target_revenue_min <= args.max_revenue!
      );
    }

    return { buyers: filteredBuyers, total: filteredBuyers.length };
  } catch (err) {
    return { buyers: [], total: 0, error: String(err) };
  }
}

export async function getScoreBreakdown(
  supabase: SupabaseClient,
  args: { buyer_id: string; deal_id: string }
): Promise<{ score: any; error?: string }> {
  try {
    const { data: score, error } = await supabase
      .from('remarketing_scores')
      .select('*')
      .eq('buyer_id', args.buyer_id)
      .eq('listing_id', args.deal_id)
      .single();

    if (error) {
      return { score: null, error: error.message };
    }

    return { score };
  } catch (err) {
    return { score: null, error: String(err) };
  }
}

export async function getContactDetails(
  supabase: SupabaseClient,
  args: { buyer_id: string }
): Promise<{ contacts: any[]; total: number; error?: string }> {
  try {
    const { data: contacts, error } = await supabase
      .from('buyer_contacts')
      .select('*')
      .eq('buyer_id', args.buyer_id)
      .order('is_primary_contact', { ascending: false });

    if (error) {
      return { contacts: [], total: 0, error: error.message };
    }

    return { contacts: contacts || [], total: contacts?.length || 0 };
  } catch (err) {
    return { contacts: [], total: 0, error: String(err) };
  }
}

export async function getAcquisitionHistory(
  supabase: SupabaseClient,
  args: { buyer_id: string; limit?: number }
): Promise<{ acquisitions: any[]; total: number; error?: string }> {
  try {
    const { data: buyer, error } = await supabase
      .from('remarketing_buyers')
      .select('recent_acquisitions, total_acquisitions, last_acquisition_date')
      .eq('id', args.buyer_id)
      .single();

    if (error) {
      return { acquisitions: [], total: 0, error: error.message };
    }

    const recentAcquisitions = buyer?.recent_acquisitions || [];
    const limit = args.limit || 10;

    return {
      acquisitions: Array.isArray(recentAcquisitions)
        ? recentAcquisitions.slice(0, limit)
        : [],
      total: buyer?.total_acquisitions || 0
    };
  } catch (err) {
    return { acquisitions: [], total: 0, error: String(err) };
  }
}

// ============================================================================
// TOOL EXECUTION ROUTER
// ============================================================================

export async function executeToolCall(
  supabase: SupabaseClient,
  toolName: string,
  args: any
): Promise<any> {
  console.log(`[chat-tools] Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'search_transcripts':
      return await searchTranscripts(supabase, args);

    case 'get_buyer_details':
      return await getBuyerDetails(supabase, args);

    case 'search_buyers_by_criteria':
      return await searchBuyersByCriteria(supabase, args);

    case 'get_score_breakdown':
      return await getScoreBreakdown(supabase, args);

    case 'get_contact_details':
      return await getContactDetails(supabase, args);

    case 'get_acquisition_history':
      return await getAcquisitionHistory(supabase, args);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
