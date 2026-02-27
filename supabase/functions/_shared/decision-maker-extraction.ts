/**
 * Decision Maker Extraction via LLM
 *
 * Takes formatted Google search results and extracts structured contact data
 * using Gemini. Adapted from the proven Python decision-maker-finder approach:
 *   1. Multiple targeted search queries find executives, founders, partners
 *   2. LLM extracts names, titles, LinkedIn URLs, emails, phone numbers
 *   3. Results are validated and deduplicated
 *
 * Much faster than Apify LinkedIn scraping (1-2s vs 120s) and more reliable.
 */

import {
  GEMINI_API_URL,
  DEFAULT_GEMINI_MODEL,
  getGeminiHeaders,
  fetchWithAutoRetry,
} from './ai-providers.ts';
import { validateLinkedInProfileUrl } from './serper-client.ts';

export interface ExtractedContact {
  first_name: string;
  last_name: string;
  title: string;
  linkedin_url: string;
  generic_email: string;
  source_url: string;
  company_phone: string;
}

const EXTRACTION_PROMPT = `You are an expert assistant for structured data extraction. Your task is to analyze Google search result text and extract ALL relevant contacts.

Your goal is to identify:
1. High-level decision-makers (C-level executives, founders, owners)
2. Mid-level contacts (VPs, General Managers)
3. Generic company contact emails

---

RULES:

1. Look for these contact types:

   **HIGH-LEVEL DECISION MAKERS:**
   Owner, Founder / Co-Founder, CEO, CFO, President, Co-Owner, Managing Partner, Principal, COO, Chairman

   **MID-LEVEL CONTACTS:**
   VP of Finance, General Manager, other VP-level positions

   **GENERIC EMAILS:**
   Any generic company emails (info@, contact@, sales@, etc.)

2. For each valid contact, return:
   - first_name: Only the first name, proper capitalization. (Empty string "" for generic emails)
   - last_name: Only the last name, proper capitalization. (Empty string "" for generic emails)
   - title: Exact job title as written. Use "Generic Email" for generic emails.
   - linkedin_url: Must be a valid LinkedIn personal profile URL containing 'linkedin.com/in/'. Not company or post URLs. Empty string "" if not found.
   - generic_email: The generic email address if applicable, otherwise empty string "".
   - source_url: The URL where you found this information.
   - company_phone: Company phone number from results (empty string "" if not found).

3. DEDUPLICATION:
   - Same person (same first+last name) appearing multiple times: keep only once with the most specific title.
   - Same generic email: keep only once.

4. IGNORE:
   - People with titles like Engineer, Recruiter, Technician, HR
   - Placeholders like "Contact 2"
   - Hidden/obfuscated emails (e.g., infod********e@abc.com)

5. Do NOT hallucinate data. Only extract what is present in the text.

---

INPUT: Google search results with query, title, link, and snippet separated by "---".

OUTPUT: Return ONLY a JSON array. No explanation or extra text.

Example output:
[
  {
    "first_name": "Wes",
    "last_name": "Dorman",
    "title": "President and Chief Executive Officer",
    "linkedin_url": "",
    "generic_email": "",
    "source_url": "https://www.example.com/team",
    "company_phone": "(614) 316-2342"
  },
  {
    "first_name": "",
    "last_name": "",
    "title": "Generic Email",
    "linkedin_url": "",
    "generic_email": "info@example.com",
    "source_url": "https://www.example.com/",
    "company_phone": "(614) 316-2342"
  }
]

If no contacts are found, return: []`;

/**
 * Extract decision-maker contacts from formatted search results using Gemini.
 *
 * @param searchSummary  Formatted search results text from formatSearchResultsForLLM()
 * @param domain         Company domain (for context)
 * @param companyName    Company name (for context)
 * @returns Array of extracted contacts with validated fields
 */
export async function extractDecisionMakers(
  searchSummary: string,
  domain: string,
  companyName: string,
): Promise<ExtractedContact[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.warn('[decision-maker-extraction] GEMINI_API_KEY not configured');
    return [];
  }

  if (!searchSummary.trim()) {
    return [];
  }

  try {
    const response = await fetchWithAutoRetry(
      GEMINI_API_URL,
      {
        method: 'POST',
        headers: getGeminiHeaders(apiKey),
        body: JSON.stringify({
          model: DEFAULT_GEMINI_MODEL,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            {
              role: 'user',
              content: `Extract contacts for company "${companyName}" (${domain}):\n\n${searchSummary}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(30000),
      },
      { maxRetries: 2, baseDelayMs: 2000, callerName: 'DecisionMakerExtraction' },
    );

    if (!response.ok) {
      console.error(`[decision-maker-extraction] Gemini API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return parseAndValidateContacts(content, domain, companyName);
  } catch (err) {
    console.error(`[decision-maker-extraction] Error: ${err}`);
    return [];
  }
}

/**
 * Parse LLM response into validated contacts.
 */
function parseAndValidateContacts(
  content: string,
  _domain: string,
  _companyName: string,
): ExtractedContact[] {
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1]?.split('```')[0]?.trim() || '';
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1]?.split('```')[0]?.trim() || '';
  }

  let contacts: any[];
  try {
    contacts = JSON.parse(jsonStr);
    if (!Array.isArray(contacts)) return [];
  } catch {
    console.warn('[decision-maker-extraction] Failed to parse LLM response as JSON');
    return [];
  }

  // Validate and normalize each contact
  const seen = new Set<string>();

  return contacts
    .filter((c) => {
      if (!c || typeof c !== 'object') return false;

      // Must have either a name+title or a generic email
      const hasName = c.first_name?.trim() && c.last_name?.trim();
      const hasGenericEmail = c.generic_email?.trim();
      if (!hasName && !hasGenericEmail) return false;

      // Dedup by name or email
      const key = hasName
        ? `${c.first_name.trim().toLowerCase()}:${c.last_name.trim().toLowerCase()}`
        : c.generic_email.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .map((c) => ({
      first_name: c.first_name?.trim() || '',
      last_name: c.last_name?.trim() || '',
      title: c.title?.trim() || '',
      linkedin_url: validateLinkedInProfileUrl(c.linkedin_url),
      generic_email: c.generic_email?.trim() || '',
      source_url: c.source_url?.trim() || '',
      company_phone: c.company_phone?.trim() || '',
    }));
}
