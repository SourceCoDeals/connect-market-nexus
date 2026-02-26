/**
 * 30-Question QA Suite for AI Command Center
 *
 * Each question has:
 *  - category, question, expected route, expected tools
 *  - predicted response summary (what we THINK will happen)
 *  - predicted quality rating (1-10)
 *
 * The test runner sends each question via sendAIQuery() and displays
 * actual results alongside predictions for comparison.
 *
 * IMPORTANT: expectedRoute values MUST match actual router categories defined
 * in supabase/functions/ai-command-center/router.ts. The router has ~36
 * categories — do NOT invent categories that don't exist (e.g. OUTREACH,
 * CONTENT_CREATION, MARKET_ANALYSIS, CALLING_LIST are NOT valid routes).
 */

export interface QAQuestion {
  id: number;
  category: string;
  question: string;
  expectedRoute: string;
  expectedTools: string[];
  predictedResponse: string;
  predictedRating: number; // 1-10
}

export interface QAResult {
  id: number;
  status: 'pending' | 'running' | 'done' | 'error';
  actualResponse: string;
  actualRoute: string;
  actualTools: string[];
  durationMs: number;
  actualRating: number | null; // user can rate
  error?: string;
}

export const THIRTY_Q_STORAGE_KEY = 'sourceco-30q-test-results';

export function getThirtyQuestions(): QAQuestion[] {
  return [
    // ── PIPELINE ANALYTICS (3) ──
    {
      id: 1,
      category: 'Pipeline Analytics',
      question: 'How many total deals are in the pipeline?',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Should call get_pipeline_summary and return a specific deal count with a breakdown by status. Will include numbers like "X active deals" with stage distribution.',
      predictedRating: 9,
    },
    {
      id: 2,
      category: 'Pipeline Analytics',
      question: 'Show me a breakdown of deals by status',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Bypass rule matches "breakdown...deals" pattern. Should call get_pipeline_summary and present a table or list showing deal counts per status (screening, active marketing, LOI, etc.).',
      predictedRating: 9,
    },
    {
      id: 3,
      category: 'Pipeline Analytics',
      question: 'How many HVAC deals do we have?',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Bypass rule matches industry-specific deal count pattern. Should use query_deals with industry filter for HVAC. Will return a count and possibly list the HVAC deals by name.',
      predictedRating: 8,
    },

    // ── DEAL STATUS (3) ──
    {
      id: 4,
      category: 'Deal Status',
      question: 'What are our most recent deals?',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals', 'get_pipeline_summary'],
      predictedResponse:
        'Bypass rule matches "our...deals" pattern. Should call query_deals sorted by created_at desc. Will list 5-10 most recent deals with names, industries, and statuses.',
      predictedRating: 9,
    },
    {
      id: 5,
      category: 'Deal Status',
      question: 'Which deals are in the screening stage?',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals', 'get_pipeline_summary'],
      predictedResponse:
        'Bypass rule matches "which deals...in" pattern. Should filter deals by status=screening. Will list matching deals with names and details.',
      predictedRating: 8,
    },
    {
      id: 6,
      category: 'Deal Status',
      question: 'Show me deals in the collision repair industry',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals', 'get_pipeline_summary'],
      predictedResponse:
        'Bypass rule matches "show...deals...in" pattern. Should query_deals with industry filter for collision repair. Will return real deals with names and details.',
      predictedRating: 8,
    },

    // ── BUYER SEARCH (3) ──
    {
      id: 7,
      category: 'Buyer Search',
      question: 'Find buyers interested in HVAC companies',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Bypass rule matches "buyers" + "interested" keywords. Should call search_buyers with industry/interest filter. Will return a list of buyers with names, types (PE/strategic), and relevant details.',
      predictedRating: 8,
    },
    {
      id: 8,
      category: 'Buyer Search',
      question: 'Show me all strategic buyers',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Bypass rule matches "strategic" + "show" keywords. Should filter search_buyers by buyer_type=strategic. Will list strategic buyers with basic info.',
      predictedRating: 8,
    },
    {
      id: 9,
      category: 'Buyer Search',
      question: 'Which buyers are located in Florida?',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Bypass rule matches "buyers" + "located" keywords. Should search_buyers with location filter for Florida. Quality depends on whether location data is populated.',
      predictedRating: 6,
    },

    // ── CONTACTS (2) ──
    {
      id: 10,
      category: 'Contacts',
      question: 'Show me contacts at Alpine Investors',
      expectedRoute: 'CONTACTS',
      expectedTools: ['search_contacts', 'search_pe_contacts', 'find_and_enrich_person'],
      predictedResponse:
        'Bypass rule matches "show me...contacts" and "contacts at" patterns. Should search contacts/PE contacts for "Alpine Investors". Will return names, titles, emails if available.',
      predictedRating: 7,
    },
    {
      id: 11,
      category: 'Contacts',
      question: 'Who are the most recently added contacts?',
      expectedRoute: 'CONTACTS',
      expectedTools: ['search_contacts', 'search_pe_contacts'],
      predictedResponse:
        'Bypass rule matches "recently...contacts" pattern. Should call search_contacts sorted by created_at. Will list recent contacts with names and firms.',
      predictedRating: 7,
    },

    // ── CONTACT ENRICHMENT (2) ──
    {
      id: 12,
      category: 'Contact Enrichment',
      question: 'Find the email address for the CEO of Alpine Investors',
      expectedRoute: 'CONTACTS',
      expectedTools: ['find_and_enrich_person', 'search_contacts', 'search_pe_contacts', 'enrich_buyer_contacts'],
      predictedResponse:
        'Bypass rule matches "email address for" pattern → CONTACTS route (which includes enrichment tools). Will attempt find_and_enrich_person. May fail if Prospeo API key is not configured, but will search existing contacts first.',
      predictedRating: 6,
    },
    {
      id: 13,
      category: 'Contact Enrichment',
      question: 'Enrich all contacts for our top HVAC buyer',
      expectedRoute: 'CONTACT_ENRICHMENT',
      expectedTools: ['enrich_buyer_contacts', 'search_contacts', 'search_pe_contacts'],
      predictedResponse:
        'Bypass rule matches "enrich" keyword → CONTACT_ENRICHMENT route. Will first search_buyers to find the top HVAC buyer, then attempt enrich_buyer_contacts. Enrichment step may fail due to missing API key.',
      predictedRating: 4,
    },

    // ── PLATFORM GUIDE (3) ──
    {
      id: 14,
      category: 'Platform Guide',
      question: 'How do I create a new deal?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_current_user_context'],
      predictedResponse:
        'Bypass rule matches "how do I" + "deal" keywords. Should return step-by-step instructions for creating a deal from the system prompt knowledge. Clear, actionable guidance.',
      predictedRating: 8,
    },
    {
      id: 15,
      category: 'Platform Guide',
      question: 'What is the remarketing feature and how does it work?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_current_user_context'],
      predictedResponse:
        'Bypass rule matches "what is" + "remarketing" keywords. Should explain remarketing: outreach campaigns to buyers, email sequences, PhoneBurner integration. Knowledge is in the system prompt.',
      predictedRating: 8,
    },
    {
      id: 16,
      category: 'Platform Guide',
      question: 'How does deal scoring work?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_current_user_context'],
      predictedResponse:
        'Bypass rule matches "how does...work" pattern. Should explain the scoring methodology from system prompt knowledge. May be general if scoring details are not fully documented.',
      predictedRating: 7,
    },

    // ── TRANSCRIPT / MEETING INTEL (3) ──
    {
      id: 17,
      category: 'Meeting Intel',
      question: 'Search Fireflies for calls about valuation expectations',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['semantic_transcript_search', 'search_transcripts', 'search_fireflies'],
      predictedResponse:
        'Bypass rule matches "Fireflies" keyword. Should call semantic_transcript_search with "valuation expectations". Results depend on transcript data availability. Should return snippets if matches found.',
      predictedRating: 7,
    },
    {
      id: 18,
      category: 'Meeting Intel',
      question: 'What have buyers said about geographic expansion in recent calls?',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['semantic_transcript_search', 'search_transcripts', 'search_fireflies'],
      predictedResponse:
        'Bypass rule matches "said" keyword. Should use semantic_transcript_search with expanded keywords. Quality depends on transcript content in the DB.',
      predictedRating: 6,
    },
    {
      id: 19,
      category: 'Meeting Intel',
      question: 'Find any transcript mentioning management retention concerns',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['semantic_transcript_search', 'search_transcripts', 'search_fireflies'],
      predictedResponse:
        'Bypass rule matches "transcript" keyword. Will search for "management retention" across deal and buyer transcripts. Results depend on data.',
      predictedRating: 6,
    },

    // ── OUTREACH / FOLLOW-UP (2) ──
    {
      id: 20,
      category: 'Outreach',
      question: "What's the status of our outreach campaigns?",
      expectedRoute: 'FOLLOW_UP',
      expectedTools: ['get_outreach_records', 'get_remarketing_outreach', 'get_deal_tasks', 'get_outreach_status'],
      predictedResponse:
        'Bypass rule matches "outreach campaigns" and "status of...outreach" patterns → FOLLOW_UP route with outreach tools. Should report on active campaigns, response rates, and recent activity.',
      predictedRating: 8,
    },
    {
      id: 21,
      category: 'Follow-Up',
      question: 'Which buyers need follow-up this week?',
      expectedRoute: 'FOLLOW_UP',
      expectedTools: ['get_deal_tasks', 'get_current_user_context'],
      predictedResponse:
        'Bypass rule matches "follow-up" keyword. Should identify buyers with pending follow-ups or recent engagement. Will use get_deal_tasks to find upcoming tasks.',
      predictedRating: 7,
    },

    // ── DAILY BRIEFING (1) ──
    {
      id: 22,
      category: 'Daily Briefing',
      question: 'Give me a morning briefing',
      expectedRoute: 'DAILY_BRIEFING',
      expectedTools: ['get_follow_up_queue', 'get_analytics', 'get_cross_deal_analytics'],
      predictedResponse:
        'Bypass rule matches "morning briefing" pattern. Should combine pipeline summary + outreach status into a concise daily briefing covering deal counts, recent activity, pending follow-ups, and key metrics.',
      predictedRating: 9,
    },

    // ── ENGAGEMENT (1) ──
    {
      id: 23,
      category: 'Engagement',
      question: 'Show me the latest buyer engagement activity',
      expectedRoute: 'ENGAGEMENT',
      expectedTools: ['get_engagement_signals', 'get_buyer_decisions', 'get_score_history'],
      predictedResponse:
        'Bypass rule matches "engagement...activity" pattern. Should call get_engagement_signals and return recent buyer interactions — site visits, document views, IOIs, calls. Chronological format.',
      predictedRating: 7,
    },

    // ── CONTENT CREATION / OUTREACH DRAFT (2) ──
    {
      id: 24,
      category: 'Content Creation',
      question:
        'Write a LinkedIn post about the collision repair market based on our deal data',
      expectedRoute: 'OUTREACH_DRAFT',
      expectedTools: ['get_deal_details', 'get_buyer_profile'],
      predictedResponse:
        'Bypass rule matches "write" keyword → OUTREACH_DRAFT route. Should first query deals for collision repair data, then generate a professional LinkedIn post referencing real deal metrics if available.',
      predictedRating: 8,
    },
    {
      id: 25,
      category: 'Content Creation',
      question:
        'Draft an outreach email to PE firms about our new HVAC acquisition opportunity',
      expectedRoute: 'OUTREACH_DRAFT',
      expectedTools: ['get_deal_details', 'get_buyer_profile'],
      predictedResponse:
        'Bypass rule matches "draft" keyword → OUTREACH_DRAFT route. Should look up HVAC deals and draft a professional outreach email with deal highlights and a call-to-action.',
      predictedRating: 8,
    },

    // ── PIPELINE ANALYTICS / INDUSTRY (1) ──
    {
      id: 26,
      category: 'Market Analysis',
      question: 'Which industries have the most deals in our pipeline?',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Bypass rule matches "which industries...deals" pattern → PIPELINE_ANALYTICS. Should aggregate deals by industry and present a ranked list. Clear data-driven response.',
      predictedRating: 8,
    },

    // ── CONTACT ENRICHMENT / CALLING LIST (1) ──
    {
      id: 27,
      category: 'Calling List',
      question: 'Build me a calling list for HVAC buyers with phone numbers',
      expectedRoute: 'CONTACT_ENRICHMENT',
      expectedTools: ['search_lead_sources', 'search_valuation_leads', 'query_deals', 'search_contacts', 'enrich_buyer_contacts'],
      predictedResponse:
        'Bypass rule matches "calling list" pattern → CONTACT_ENRICHMENT route. Should search_buyers for HVAC interest, then search_contacts for phone numbers. Phone data may be sparse.',
      predictedRating: 6,
    },

    // ── BUYER SEARCH / LEAD INTEL (1) ──
    {
      id: 28,
      category: 'Lead Intel',
      question: 'What do we know about New Heritage Capital as a buyer?',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers', 'get_buyer_profile', 'search_contacts'],
      predictedResponse:
        'Bypass rule matches "what do we know...buyer" pattern → BUYER_SEARCH with profile tools. Should search_buyers for "New Heritage Capital" and return investment criteria, past deals, engagement history.',
      predictedRating: 7,
    },

    // ── SMARTLEAD OUTREACH / ACTION (1) ──
    {
      id: 29,
      category: 'Action',
      question: 'Push our top 5 HVAC buyers to a SmartLead campaign',
      expectedRoute: 'SMARTLEAD_OUTREACH',
      expectedTools: ['push_to_smartlead', 'get_smartlead_campaigns', 'search_buyers', 'search_contacts'],
      predictedResponse:
        'Bypass rule matches "push...SmartLead" pattern → SMARTLEAD_OUTREACH route. Should first search_buyers for top HVAC buyers, then attempt push_to_smartlead. Will require confirmation before executing.',
      predictedRating: 6,
    },

    // ── PLATFORM GUIDE / EDGE CASE (1) ──
    {
      id: 30,
      category: 'Edge Case',
      question: 'What can you help me with?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_current_user_context'],
      predictedResponse:
        'Bypass rule matches "what can you help" pattern → PLATFORM_GUIDE. Should return a capabilities overview — deal management, buyer search, outreach, transcripts, content creation, etc.',
      predictedRating: 9,
    },
  ];
}
