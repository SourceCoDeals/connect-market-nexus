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
      expectedTools: ['get_pipeline_summary'],
      predictedResponse:
        'Should call get_pipeline_summary and return a specific deal count with a breakdown by status. Will include numbers like "X active deals" with stage distribution.',
      predictedRating: 9,
    },
    {
      id: 2,
      category: 'Pipeline Analytics',
      question: 'Show me a breakdown of deals by status',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary'],
      predictedResponse:
        'Should call get_pipeline_summary and present a table or list showing deal counts per status (screening, active marketing, LOI, etc.). Well-structured response expected.',
      predictedRating: 9,
    },
    {
      id: 3,
      category: 'Pipeline Analytics',
      question: 'How many HVAC deals do we have?',
      expectedRoute: 'PIPELINE_ANALYTICS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Should use query_deals with industry filter for HVAC. Will return a count and possibly list the HVAC deals by name. This was a known test case that previously worked.',
      predictedRating: 8,
    },

    // ── DEAL STATUS (3) ──
    {
      id: 4,
      category: 'Deal Status',
      question: 'What are our most recent deals?',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals'],
      predictedResponse:
        'Should call query_deals sorted by created_at desc. Will list 5-10 most recent deals with names, industries, and statuses. Clean tabular or bullet format.',
      predictedRating: 9,
    },
    {
      id: 5,
      category: 'Deal Status',
      question: 'Which deals are in the screening stage?',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals'],
      predictedResponse:
        'Should filter deals by status=screening. Will list matching deals. If none in screening, will say so clearly rather than hallucinating.',
      predictedRating: 8,
    },
    {
      id: 6,
      category: 'Deal Status',
      question: 'Show me deals in the collision repair industry',
      expectedRoute: 'DEAL_STATUS',
      expectedTools: ['query_deals'],
      predictedResponse:
        'Should query_deals with industry filter for collision repair. Given this is a known vertical in the system, should return real deals with names and details.',
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
        'Should call search_buyers with industry/interest filter. Will return a list of buyers with names, types (PE/strategic), and relevant details. Well-structured.',
      predictedRating: 8,
    },
    {
      id: 8,
      category: 'Buyer Search',
      question: 'Show me all strategic buyers',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Should filter search_buyers by buyer_type=strategic. Will list strategic buyers with basic info. May be a long list if many exist.',
      predictedRating: 8,
    },
    {
      id: 9,
      category: 'Buyer Search',
      question: 'Which buyers are located in Florida?',
      expectedRoute: 'BUYER_SEARCH',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Should search_buyers with location filter for Florida. Quality depends on whether location data is populated. May return empty if location field is sparse.',
      predictedRating: 6,
    },

    // ── CONTACTS (2) ──
    {
      id: 10,
      category: 'Contacts',
      question: 'Show me contacts at Alpine Investors',
      expectedRoute: 'CONTACTS',
      expectedTools: ['search_contacts', 'search_pe_contacts'],
      predictedResponse:
        'Should search contacts/PE contacts for "Alpine Investors". Will return names, titles, emails if available. Quality depends on data in the system.',
      predictedRating: 7,
    },
    {
      id: 11,
      category: 'Contacts',
      question: 'Who are the most recently added contacts?',
      expectedRoute: 'CONTACTS',
      expectedTools: ['search_contacts'],
      predictedResponse:
        'Should call search_contacts sorted by created_at. Will list recent contacts with names and firms. Straightforward DB query.',
      predictedRating: 7,
    },

    // ── CONTACT ENRICHMENT (2) ──
    {
      id: 12,
      category: 'Contact Enrichment',
      question: 'Find the email address for the CEO of Alpine Investors',
      expectedRoute: 'CONTACT_ENRICHMENT',
      expectedTools: ['find_and_enrich_person', 'enrich_buyer_contacts'],
      predictedResponse:
        'Will attempt to call enrichment tools but LIKELY FAIL — Prospeo API key may not be configured. Expected to return an error message about enrichment being unavailable or timing out.',
      predictedRating: 3,
    },
    {
      id: 13,
      category: 'Contact Enrichment',
      question: 'Enrich all contacts for our top HVAC buyer',
      expectedRoute: 'CONTACT_ENRICHMENT',
      expectedTools: ['search_buyers', 'enrich_buyer_contacts'],
      predictedResponse:
        'Will first search_buyers to find the top HVAC buyer, then attempt enrich_buyer_contacts. Enrichment step will likely fail due to missing API key. Partial success — finds buyer but cannot enrich.',
      predictedRating: 4,
    },

    // ── PLATFORM GUIDE (3) ──
    {
      id: 14,
      category: 'Platform Guide',
      question: 'How do I create a new deal?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_knowledge_articles'],
      predictedResponse:
        'Should call get_knowledge_articles and return step-by-step instructions for creating a deal. Clear, actionable guidance. This is a core platform question that should work well.',
      predictedRating: 9,
    },
    {
      id: 15,
      category: 'Platform Guide',
      question: 'What is the remarketing feature and how does it work?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_knowledge_articles'],
      predictedResponse:
        'Should explain remarketing: outreach campaigns to buyers, email sequences, PhoneBurner integration, etc. Well-documented feature in the knowledge base.',
      predictedRating: 8,
    },
    {
      id: 16,
      category: 'Platform Guide',
      question: 'How does deal scoring work?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: ['get_knowledge_articles'],
      predictedResponse:
        'Should explain the scoring methodology. May be general if scoring details are not fully documented in knowledge articles. Should not hallucinate specific weights.',
      predictedRating: 7,
    },

    // ── TRANSCRIPT / MEETING INTEL (3) ──
    {
      id: 17,
      category: 'Meeting Intel',
      question: 'Search Fireflies for calls about valuation expectations',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['search_fireflies', 'semantic_transcript_search'],
      predictedResponse:
        'Should call semantic_transcript_search with "valuation expectations". Will search deal_transcripts and buyer_transcripts. Results depend on transcript data availability. Should return snippets if matches found.',
      predictedRating: 7,
    },
    {
      id: 18,
      category: 'Meeting Intel',
      question: 'What have buyers said about geographic expansion in recent calls?',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['semantic_transcript_search'],
      predictedResponse:
        'Should use semantic_transcript_search with expanded keywords. Quality depends on transcript content in the DB. If transcripts exist with this topic, will return relevant snippets.',
      predictedRating: 6,
    },
    {
      id: 19,
      category: 'Meeting Intel',
      question: 'Find any transcript mentioning management retention concerns',
      expectedRoute: 'MEETING_INTEL',
      expectedTools: ['semantic_transcript_search', 'search_fireflies'],
      predictedResponse:
        'Will search for "management retention" across transcripts. The semantic search fix should allow this to work across both deal and buyer transcripts. Results depend on data.',
      predictedRating: 6,
    },

    // ── OUTREACH / FOLLOW-UP (2) ──
    {
      id: 20,
      category: 'Outreach',
      question: "What's the status of our outreach campaigns?",
      expectedRoute: 'OUTREACH',
      expectedTools: ['get_outreach_status', 'get_remarketing_outreach'],
      predictedResponse:
        'Should call get_outreach_status and report on active campaigns, response rates, and recent activity. Well-structured response with metrics.',
      predictedRating: 8,
    },
    {
      id: 21,
      category: 'Follow-Up',
      question: 'Which buyers need follow-up this week?',
      expectedRoute: 'FOLLOW_UP',
      expectedTools: ['get_outreach_status'],
      predictedResponse:
        'Should identify buyers with pending follow-ups or recent engagement. May use get_outreach_status to find stale conversations. Quality depends on outreach data.',
      predictedRating: 7,
    },

    // ── DAILY BRIEFING (1) ──
    {
      id: 22,
      category: 'Daily Briefing',
      question: 'Give me a morning briefing',
      expectedRoute: 'DAILY_BRIEFING',
      expectedTools: ['get_pipeline_summary', 'get_outreach_status'],
      predictedResponse:
        'Should combine pipeline summary + outreach status into a concise daily briefing. Expected to cover: deal counts, recent activity, pending follow-ups, and key metrics. Well-formatted.',
      predictedRating: 9,
    },

    // ── ENGAGEMENT (1) ──
    {
      id: 23,
      category: 'Engagement',
      question: 'Show me the latest buyer engagement activity',
      expectedRoute: 'ENGAGEMENT',
      expectedTools: ['get_engagement_feed'],
      predictedResponse:
        'Should call get_engagement_feed and return recent buyer interactions — emails opened, links clicked, responses received. Chronological feed format.',
      predictedRating: 7,
    },

    // ── CONTENT CREATION (2) ──
    {
      id: 24,
      category: 'Content Creation',
      question:
        'Write a LinkedIn post about the collision repair market based on our deal data',
      expectedRoute: 'CONTENT_CREATION',
      expectedTools: ['query_deals'],
      predictedResponse:
        'Should first query_deals for collision repair data, then generate a professional LinkedIn post. Will reference real deal metrics if available. Creative and well-formatted content.',
      predictedRating: 8,
    },
    {
      id: 25,
      category: 'Content Creation',
      question:
        'Draft an outreach email to PE firms about our new HVAC acquisition opportunity',
      expectedRoute: 'CONTENT_CREATION',
      expectedTools: ['query_deals'],
      predictedResponse:
        'Should look up HVAC deals and draft a professional outreach email. Will include deal highlights and a call-to-action. May query deals first for specifics.',
      predictedRating: 8,
    },

    // ── MARKET ANALYSIS (1) ──
    {
      id: 26,
      category: 'Market Analysis',
      question: 'Which industries have the most deals in our pipeline?',
      expectedRoute: 'MARKET_ANALYSIS',
      expectedTools: ['get_pipeline_summary', 'query_deals'],
      predictedResponse:
        'Should aggregate deals by industry. Will call get_pipeline_summary or query_deals. Should present a ranked list of industries by deal count. Clear data-driven response.',
      predictedRating: 8,
    },

    // ── CALLING LIST (1) ──
    {
      id: 27,
      category: 'Calling List',
      question: 'Build me a calling list for HVAC buyers with phone numbers',
      expectedRoute: 'CALLING_LIST',
      expectedTools: ['search_buyers', 'search_contacts'],
      predictedResponse:
        'Should search_buyers for HVAC interest, then search_contacts for their phone numbers. Will compile a list. Phone data may be sparse — quality depends on contact data completeness.',
      predictedRating: 6,
    },

    // ── LEAD INTEL (1) ──
    {
      id: 28,
      category: 'Lead Intel',
      question: 'What do we know about New Heritage Capital as a buyer?',
      expectedRoute: 'LEAD_INTEL',
      expectedTools: ['search_buyers'],
      predictedResponse:
        'Should search_buyers for "New Heritage Capital" and return any stored information — investment criteria, past deals, contacts, engagement history. Quality depends on data richness.',
      predictedRating: 7,
    },

    // ── ACTION (1) ──
    {
      id: 29,
      category: 'Action',
      question: 'Push our top 5 HVAC buyers to a SmartLead campaign',
      expectedRoute: 'ACTION',
      expectedTools: ['search_buyers', 'push_to_smartlead'],
      predictedResponse:
        'Should first search_buyers for top HVAC buyers, then attempt push_to_smartlead. Will likely require confirmation before executing. May fail if SmartLead integration is not configured.',
      predictedRating: 5,
    },

    // ── CHITCHAT / EDGE CASE (1) ──
    {
      id: 30,
      category: 'Edge Case',
      question: 'What can you help me with?',
      expectedRoute: 'PLATFORM_GUIDE',
      expectedTools: [],
      predictedResponse:
        'Should return a capabilities overview — deal management, buyer search, outreach, transcripts, content creation, etc. Bypass rule should catch this as a platform guide question. Well-formatted list of capabilities.',
      predictedRating: 9,
    },
  ];
}
