/**
 * 30-Question QA Suite
 *
 * Pre-built test questions across all AI Command Center categories.
 * Each question has a predicted/expected response summary and category tag.
 */

export interface ThirtyQQuestion {
  id: number;
  category: string;
  question: string;
  expectedBehavior: string;
}

export const THIRTY_Q_SUITE: ThirtyQQuestion[] = [
  // Pipeline Analytics (1-3)
  { id: 1, category: 'Pipeline Analytics', question: 'How many deals are currently in the pipeline?', expectedBehavior: 'Returns a specific numeric count of active deals using get_pipeline_summary tool.' },
  { id: 2, category: 'Pipeline Analytics', question: 'What is the total revenue across all active deals?', expectedBehavior: 'Aggregates revenue figures from pipeline data; returns a dollar amount.' },
  { id: 3, category: 'Pipeline Analytics', question: 'Show me a breakdown of deals by status', expectedBehavior: 'Groups deals by status (e.g. new, active, closed) with counts for each.' },

  // Deal Status (4-5)
  { id: 4, category: 'Deal Status', question: 'What is the status of the most recent deal added?', expectedBehavior: 'Identifies the latest deal by created_at and returns its current status and key details.' },
  { id: 5, category: 'Deal Status', question: 'Which deals were updated in the last 7 days?', expectedBehavior: 'Queries deals with recent activity and lists them with update timestamps.' },

  // Buyer Search (6-8)
  { id: 6, category: 'Buyer Search', question: 'Find buyers interested in HVAC companies', expectedBehavior: 'Routes to BUYER_SEARCH category; uses search_buyers tool with HVAC-related criteria.' },
  { id: 7, category: 'Buyer Search', question: 'Which PE firms are looking for businesses in Texas?', expectedBehavior: 'Searches buyers with Texas geography preference; returns matching firms.' },
  { id: 8, category: 'Buyer Search', question: 'Show me buyers with EBITDA range between 2M and 5M', expectedBehavior: 'Filters buyers by min/max EBITDA criteria; returns relevant matches.' },

  // Contacts (9-10)
  { id: 9, category: 'Contacts', question: 'Who is the main contact for our newest deal?', expectedBehavior: 'Looks up the most recent deal and returns main_contact_name, email, phone.' },
  { id: 10, category: 'Contacts', question: 'List all contacts that have been reached out to this month', expectedBehavior: 'Queries contact history for recent outreach activity this month.' },

  // Enrichment (11-12)
  { id: 11, category: 'Enrichment', question: 'How many deals still need enrichment?', expectedBehavior: 'Counts deals where enriched_at is null or enrichment is incomplete.' },
  { id: 12, category: 'Enrichment', question: 'What enrichment data is available for the latest deal?', expectedBehavior: 'Returns enrichment fields (LinkedIn, Google reviews, etc.) for the most recent deal.' },

  // Platform Guide (13-14)
  { id: 13, category: 'Platform Guide', question: 'How do I create a new buyer universe?', expectedBehavior: 'Provides step-by-step guidance on creating a buyer universe in the platform.' },
  { id: 14, category: 'Platform Guide', question: 'What does the deal scoring system do?', expectedBehavior: 'Explains the deal scoring methodology and how scores are calculated.' },

  // Transcript Search (15-16)
  { id: 15, category: 'Transcript Search', question: 'Search transcripts for mentions of recurring revenue', expectedBehavior: 'Uses transcript search tool to find buyer call transcripts mentioning recurring revenue.' },
  { id: 16, category: 'Transcript Search', question: 'What did buyers say about geographic expansion?', expectedBehavior: 'Searches transcripts for geographic expansion discussions and summarizes findings.' },

  // Outreach (17-18)
  { id: 17, category: 'Outreach', question: 'Draft an outreach email for a landscaping company deal', expectedBehavior: 'Generates a professional outreach email template for a landscaping business acquisition.' },
  { id: 18, category: 'Outreach', question: 'What is the status of our Smartlead campaigns?', expectedBehavior: 'Queries outreach/campaign data and returns campaign status information.' },

  // Daily Briefing (19-20)
  { id: 19, category: 'Daily Briefing', question: 'Give me my daily briefing', expectedBehavior: 'Synthesizes recent activity: new deals, pending tasks, engagement updates, follow-ups.' },
  { id: 20, category: 'Daily Briefing', question: 'Catch me up on what happened this week', expectedBehavior: 'Provides a weekly summary of pipeline changes, buyer activity, and key events.' },

  // Engagement (21-22)
  { id: 21, category: 'Engagement', question: 'Which buyers have shown the most interest recently?', expectedBehavior: 'Returns buyers with recent interest signals or high engagement scores.' },
  { id: 22, category: 'Engagement', question: 'Show me the follow-up queue', expectedBehavior: 'Lists pending follow-ups with buyers/deals that need attention.' },

  // Content Creation (23-24)
  { id: 23, category: 'Content Creation', question: 'Write a teaser for a $3M revenue plumbing company in Florida', expectedBehavior: 'Generates a deal teaser/summary with key metrics for buyer outreach.' },
  { id: 24, category: 'Content Creation', question: 'Create a CIM executive summary for a commercial cleaning business', expectedBehavior: 'Drafts an executive summary section suitable for a Confidential Information Memorandum.' },

  // Market Analysis (25-26)
  { id: 25, category: 'Market Analysis', question: 'What industries have the most deals in our pipeline?', expectedBehavior: 'Aggregates deals by industry and ranks them by count.' },
  { id: 26, category: 'Market Analysis', question: 'How does our deal flow compare month over month?', expectedBehavior: 'Provides month-over-month deal volume or trend analysis.' },

  // Calling List / Lead Intel (27-28)
  { id: 27, category: 'Calling List', question: 'Generate a calling list for deals that need follow-up', expectedBehavior: 'Creates a prioritized list of contacts/deals requiring follow-up calls.' },
  { id: 28, category: 'Lead Intel', question: 'What do we know about the owner of our top-scored deal?', expectedBehavior: 'Returns owner/contact intelligence for the highest-scored deal.' },

  // Actions (29)
  { id: 29, category: 'Actions', question: 'Add a note to the most recent deal saying "Reviewed financials, looks promising"', expectedBehavior: 'Requests confirmation before executing add_deal_note action on the latest deal.' },

  // Edge Cases (30)
  { id: 30, category: 'Edge Case', question: 'asdfghjkl random nonsense query 12345', expectedBehavior: 'Handles gracefully — returns a helpful "I didn\'t understand" or clarification response without errors.' },
];
