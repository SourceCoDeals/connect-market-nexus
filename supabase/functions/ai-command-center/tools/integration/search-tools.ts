/**
 * Integration Search Tools
 * Google search for companies, people, and business information via Serper.
 */

import type { ClaudeTool } from './common.ts';
import type { ToolResult } from './common.ts';
import { googleSearch } from './common.ts';

// ---------- Tool definitions ----------

export const searchToolDefinitions: ClaudeTool[] = [
  {
    name: 'google_search_companies',
    description:
      'Search Google for companies, people, or any business information via Apify. Returns Google search results with titles, URLs, and descriptions. Use this to discover companies, find LinkedIn pages, research firms, or verify company information. For example: "search Google for HVAC companies in Florida", "find the LinkedIn page for Trivest Partners", or "look up Acme Corp website".',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Google search query. For LinkedIn pages use "company name site:linkedin.com/company". For general company search just use the company name and criteria.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum results to return (default 10, max 20)',
        },
      },
      required: ['query'],
    },
  },
];

// ---------- Executor ----------

export async function googleSearchCompanies(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string;
  if (!query?.trim()) return { error: 'query is required' };

  const maxResults = Math.min((args.max_results as number) || 10, 20);

  try {
    const results = await googleSearch(query.trim(), maxResults);

    return {
      data: {
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          is_linkedin: r.url.includes('linkedin.com'),
        })),
        total: results.length,
        query,
        message: `Found ${results.length} Google results for "${query}"`,
      },
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const is404 = errMsg.includes('404');
    const isAuth =
      errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Unauthorized');
    const isRateLimit = errMsg.includes('429');

    let diagnosis = '';
    if (is404) {
      diagnosis =
        'The Apify Google search actor may have been renamed or removed. The APIFY_API_TOKEN or actor ID may need updating in Supabase Edge Function secrets.';
    } else if (isAuth) {
      diagnosis =
        'The APIFY_API_TOKEN appears to be invalid or expired. It needs to be updated in Supabase Edge Function secrets.';
    } else if (isRateLimit) {
      diagnosis = 'Apify rate limit hit. Try again in a few minutes.';
    } else {
      diagnosis = 'This may be a temporary network issue. Try again shortly.';
    }

    return {
      error: `Google search failed: ${errMsg}`,
      data: {
        diagnosis,
        alternatives: [
          'Search the internal database using search_contacts, search_pe_contacts, or query_deals instead',
          'The user can search Google manually and paste a LinkedIn URL for enrichment via enrich_contact(mode: "linkedin")',
          'Check APIFY_API_TOKEN in Supabase Edge Function secrets if this persists',
        ],
      },
    };
  }
}
