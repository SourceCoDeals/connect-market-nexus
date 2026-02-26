/**
 * 35-Question QA Suite
 *
 * Pre-built test questions across all AI Command Center categories.
 * Each question has an expected route, predicted behavior, and category tag.
 *
 * IMPORTANT: expectedRoute values MUST match actual router categories defined
 * in supabase/functions/ai-command-center/router.ts.
 *
 * Q1-30: Original core coverage
 * Q31-35: LinkedIn profile identification & contact enrichment
 */

export interface ThirtyQQuestion {
  id: number;
  category: string;
  question: string;
  expectedRoute: string;
  expectedBehavior: string;
}

export const THIRTY_Q_SUITE: ThirtyQQuestion[] = [
  // Pipeline Analytics (1-3)
  { id: 1, category: 'Pipeline Analytics', question: 'How many deals are currently in the pipeline?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Returns a specific numeric count of active deals using get_pipeline_summary tool.' },
  { id: 2, category: 'Pipeline Analytics', question: 'What is the total revenue across all active deals?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Aggregates revenue figures from pipeline data; returns a dollar amount.' },
  { id: 3, category: 'Pipeline Analytics', question: 'Show me a breakdown of deals by status', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Groups deals by status (e.g. new, active, closed) with counts for each.' },

  // Deal Status (4-5)
  { id: 4, category: 'Deal Status', question: 'What is the status of the most recent deal added?', expectedRoute: 'DEAL_STATUS', expectedBehavior: 'Identifies the latest deal by created_at and returns its current status and key details.' },
  { id: 5, category: 'Deal Status', question: 'Which deals were updated in the last 7 days?', expectedRoute: 'DEAL_STATUS', expectedBehavior: 'Queries deals with recent activity and lists them with update timestamps.' },

  // Buyer Search (6-8)
  { id: 6, category: 'Buyer Search', question: 'Find buyers interested in HVAC companies', expectedRoute: 'BUYER_SEARCH', expectedBehavior: 'Routes to BUYER_SEARCH category; uses search_buyers tool with HVAC-related criteria.' },
  { id: 7, category: 'Buyer Search', question: 'Which PE firms are looking for businesses in Texas?', expectedRoute: 'BUYER_SEARCH', expectedBehavior: 'Searches buyers with Texas geography preference; returns matching firms.' },
  { id: 8, category: 'Buyer Search', question: 'Show me buyers with EBITDA range between 2M and 5M', expectedRoute: 'BUYER_SEARCH', expectedBehavior: 'Filters buyers by min/max EBITDA criteria; returns relevant matches.' },

  // Contacts (9-10)
  { id: 9, category: 'Contacts', question: 'Who is the main contact for our newest deal?', expectedRoute: 'CONTACTS', expectedBehavior: 'Looks up the most recent deal and returns main_contact_name, email, phone.' },
  { id: 10, category: 'Contacts', question: 'List all contacts that have been reached out to this month', expectedRoute: 'CONTACTS', expectedBehavior: 'Queries contact history for recent outreach activity this month.' },

  // Enrichment (11-12)
  { id: 11, category: 'Enrichment', question: 'How many deals still need enrichment?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Counts deals where enriched_at is null or enrichment is incomplete.' },
  { id: 12, category: 'Enrichment', question: 'What enrichment data is available for the latest deal?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Returns enrichment fields (LinkedIn, Google reviews, etc.) for the most recent deal.' },

  // Platform Guide (13-14)
  { id: 13, category: 'Platform Guide', question: 'How do I create a new buyer universe?', expectedRoute: 'PLATFORM_GUIDE', expectedBehavior: 'Provides step-by-step guidance on creating a buyer universe in the platform.' },
  { id: 14, category: 'Platform Guide', question: 'What does the deal scoring system do?', expectedRoute: 'PLATFORM_GUIDE', expectedBehavior: 'Explains the deal scoring methodology and how scores are calculated.' },

  // Transcript Search (15-16)
  { id: 15, category: 'Transcript Search', question: 'Search transcripts for mentions of recurring revenue', expectedRoute: 'MEETING_INTEL', expectedBehavior: 'Uses transcript search tool to find buyer call transcripts mentioning recurring revenue.' },
  { id: 16, category: 'Transcript Search', question: 'What did buyers say about geographic expansion?', expectedRoute: 'SEMANTIC_SEARCH', expectedBehavior: 'Searches transcripts for geographic expansion discussions and summarizes findings.' },

  // Outreach (17-18)
  { id: 17, category: 'Outreach', question: 'Draft an outreach email for a landscaping company deal', expectedRoute: 'OUTREACH_DRAFT', expectedBehavior: 'Generates a professional outreach email template for a landscaping business acquisition.' },
  { id: 18, category: 'Outreach', question: 'What is the status of our Smartlead campaigns?', expectedRoute: 'SMARTLEAD_OUTREACH', expectedBehavior: 'Queries outreach/campaign data and returns campaign status information.' },

  // Daily Briefing (19-20)
  { id: 19, category: 'Daily Briefing', question: 'Give me my daily briefing', expectedRoute: 'DAILY_BRIEFING', expectedBehavior: 'Synthesizes recent activity: new deals, pending tasks, engagement updates, follow-ups.' },
  { id: 20, category: 'Daily Briefing', question: 'Catch me up on what happened this week', expectedRoute: 'DAILY_BRIEFING', expectedBehavior: 'Provides a weekly summary of pipeline changes, buyer activity, and key events.' },

  // Engagement (21-22)
  { id: 21, category: 'Engagement', question: 'Which buyers have shown the most interest recently?', expectedRoute: 'ENGAGEMENT', expectedBehavior: 'Returns buyers with recent interest signals or high engagement scores.' },
  { id: 22, category: 'Engagement', question: 'Show me the follow-up queue', expectedRoute: 'FOLLOW_UP', expectedBehavior: 'Lists pending follow-ups with buyers/deals that need attention.' },

  // Content Creation (23-24)
  { id: 23, category: 'Content Creation', question: 'Write a teaser for a $3M revenue plumbing company in Florida', expectedRoute: 'OUTREACH_DRAFT', expectedBehavior: 'Generates a deal teaser/summary with key metrics for buyer outreach.' },
  { id: 24, category: 'Content Creation', question: 'Create a CIM executive summary for a commercial cleaning business', expectedRoute: 'OUTREACH_DRAFT', expectedBehavior: 'Drafts an executive summary section suitable for a Confidential Information Memorandum.' },

  // Market Analysis (25-26)
  { id: 25, category: 'Market Analysis', question: 'What industries have the most deals in our pipeline?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Aggregates deals by industry and ranks them by count.' },
  { id: 26, category: 'Market Analysis', question: 'How does our deal flow compare month over month?', expectedRoute: 'PIPELINE_ANALYTICS', expectedBehavior: 'Provides month-over-month deal volume or trend analysis.' },

  // Calling List / Lead Intel (27-28)
  { id: 27, category: 'Calling List', question: 'Generate a calling list for deals that need follow-up', expectedRoute: 'CONTACT_ENRICHMENT', expectedBehavior: 'Creates a prioritized list of contacts/deals requiring follow-up calls.' },
  { id: 28, category: 'Lead Intel', question: 'What do we know about the owner of our top-scored deal?', expectedRoute: 'DEAL_STATUS', expectedBehavior: 'Returns owner/contact intelligence for the highest-scored deal.' },

  // Actions (29)
  { id: 29, category: 'Actions', question: 'Add a note to the most recent deal saying "Reviewed financials, looks promising"', expectedRoute: 'ACTION', expectedBehavior: 'Requests confirmation before executing add_deal_note action on the latest deal.' },

  // Edge Cases (30)
  { id: 30, category: 'Edge Case', question: 'asdfghjkl random nonsense query 12345', expectedRoute: 'GENERAL', expectedBehavior: 'Handles gracefully — returns a helpful "I didn\'t understand" or clarification response without errors.' },

  // ---------- LinkedIn & Contact Enrichment (31-35) ----------

  // Contact finder at PE firm
  { id: 31, category: 'Contact Enrichment', question: 'Find 5 contacts at Trivest Partners', expectedRoute: 'CONTACT_ENRICHMENT', expectedBehavior: 'Uses enrich_buyer_contacts or search_pe_contacts to find associates/principals at Trivest. Returns names, titles, emails if available.' },

  // LinkedIn URL paste → enrich
  { id: 32, category: 'LinkedIn Enrichment', question: 'https://linkedin.com/in/johndoe — get me this person\'s email and phone number', expectedRoute: 'CONTACTS', expectedBehavior: 'Detects LinkedIn URL, uses enrich_linkedin_contact to look up email/phone via Prospeo. Returns enriched contact data.' },

  // Find missing LinkedIn profiles for seller contacts
  { id: 33, category: 'LinkedIn Discovery', question: 'Find LinkedIn profiles for our seller contacts that are missing them', expectedRoute: 'CONTACT_ENRICHMENT', expectedBehavior: 'Uses find_contact_linkedin to search Google for LinkedIn URLs of seller contacts without linkedin_url. Returns matched profiles with confidence.' },

  // Enrich contacts for buyer universe
  { id: 34, category: 'Contact Enrichment', question: 'Enrich the contacts for buyers in our HVAC deal universe', expectedRoute: 'CONTACT_ENRICHMENT', expectedBehavior: 'Uses enrich_buyer_contacts across HVAC universe buyers. Runs Apify LinkedIn scrape + Prospeo email waterfall. Returns enriched contacts with confidence levels.' },

  // Build calling list with phone numbers (multi-step workflow)
  { id: 35, category: 'Contact Enrichment', question: 'Build me a calling list with phone numbers for our top 10 HVAC buyers', expectedRoute: 'CONTACT_ENRICHMENT', expectedBehavior: 'Multi-step: search_buyers for HVAC → enrich_buyer_contacts for phone numbers → compile formatted calling list with name, title, phone, company.' },
];
