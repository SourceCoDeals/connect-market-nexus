/**
 * memo-financials.ts
 *
 * Extracts authoritative financial figures (revenue, ebitda) from
 * lead memo JSON content and syncs them into structured listing columns.
 *
 * Precedence:
 *  1. Existing non-zero structured values on the deal row (never overwrite real data)
 *  2. Explicit revenue_source_quote / ebitda_source_quote fields (parseable dollar amounts)
 *  3. Exact dollar values from memo sections (FINANCIAL SNAPSHOT, DEAL SNAPSHOT, etc.)
 *  4. Leave null if no authoritative point estimate exists (ranges are NOT used)
 */

interface MemoSection {
  key?: string;
  title: string;
  content: string;
}

interface ExtractedFinancials {
  revenue: number | null;
  ebitda: number | null;
}

/**
 * Parse a dollar string like "$3,000,000", "$3M", "$1.2M", "$500K" into a number.
 * Returns null if unparseable or if it looks like a range.
 */
function parseDollarAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, '').trim();

  // Match $3M, $1.2M, $500K patterns
  const shortMatch = cleaned.match(/^\$?([\d.]+)\s*(M|m|MM|mm)$/);
  if (shortMatch) return Math.round(parseFloat(shortMatch[1]) * 1_000_000);

  const kMatch = cleaned.match(/^\$?([\d.]+)\s*(K|k)$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);

  // Match $3,000,000 or $3000000
  const fullMatch = cleaned.match(/^\$?([\d]+)$/);
  if (fullMatch) return parseInt(fullMatch[1], 10);

  return null;
}

/**
 * Extract a single financial figure from a line of text.
 * Looks for patterns like "Revenue: $3,000,000" or "**Revenue**: ~$3M"
 * Rejects ranges like "$3M-$5M" or "~$3M-$4M" — those are approximations, not authoritative.
 */
function extractValueFromLine(line: string, label: string): number | null {
  // Strip markdown bold markers
  const clean = line.replace(/\*\*/g, '');

  // Find the label (case-insensitive)
  const labelIdx = clean.toLowerCase().indexOf(label.toLowerCase());
  if (labelIdx === -1) return null;

  // Get everything after the label
  const afterLabel = clean.substring(labelIdx + label.length);

  // Skip if it contains a range indicator after the dollar sign
  // e.g. "$3M-$5M" or "~$2.7M-$3.3M"
  if (afterLabel.match(/\$[\d.,]+[MmKk]?\s*[-–—]\s*\$/)) return null;

  // Extract the first dollar amount
  const dollarMatch = afterLabel.match(/\$[\d.,]+\s*[MmKk]?(?:M|MM)?/);
  if (!dollarMatch) return null;

  return parseDollarAmount(dollarMatch[0]);
}

/**
 * Extract revenue and EBITDA from memo sections.
 * Scans FINANCIAL SNAPSHOT, DEAL SNAPSHOT, and similar sections.
 */
function extractFromMemoSections(sections: MemoSection[]): ExtractedFinancials {
  let revenue: number | null = null;
  let ebitda: number | null = null;

  // Target sections most likely to have financial data
  const financialSectionKeys = [
    'financial_snapshot',
    'deal_snapshot',
    'financial_overview',
    'financials',
    'key_financial_metrics',
  ];
  const financialTitlePatterns = [/financial/i, /deal snapshot/i, /key metrics/i, /overview/i];

  // Prioritize known financial sections, then scan all
  const orderedSections = [
    ...sections.filter(
      (s) =>
        financialSectionKeys.includes(s.key || '') ||
        financialTitlePatterns.some((p) => p.test(s.title)),
    ),
    ...sections.filter(
      (s) =>
        !financialSectionKeys.includes(s.key || '') &&
        !financialTitlePatterns.some((p) => p.test(s.title)),
    ),
  ];

  for (const section of orderedSections) {
    const lines = section.content.split('\n');
    for (const line of lines) {
      if (!revenue) {
        const val = extractValueFromLine(line, 'Revenue');
        // Sanity: revenue should be > $10K and < $10B
        if (val && val >= 10_000 && val <= 10_000_000_000) {
          revenue = val;
        }
      }
      if (!ebitda) {
        const val = extractValueFromLine(line, 'EBITDA');
        // Sanity: EBITDA should be > $1K and < $5B, and also not match "EBITDA Margin"
        if (val && val >= 1_000 && val <= 5_000_000_000) {
          // Make sure this line is about EBITDA value, not EBITDA Margin
          const cleanLine = line.replace(/\*\*/g, '').toLowerCase();
          if (!cleanLine.includes('ebitda margin')) {
            ebitda = val;
          }
        }
      }
      if (revenue && ebitda) break;
    }
    if (revenue && ebitda) break;
  }

  return { revenue, ebitda };
}

/**
 * Parse a source quote field (e.g. revenue_source_quote: "Revenue is about $3M")
 */
function parseSourceQuote(quote: string | null | undefined, label: string): number | null {
  if (!quote || typeof quote !== 'string') return null;
  return extractValueFromLine(quote, label) ?? extractValueFromLine(quote, '$');
}

/**
 * Main entry: extract authoritative financials from all available sources.
 *
 * @param deal       The deal/listing row (structured columns + source quotes)
 * @param memoContent The memo JSON content with sections array
 * @returns Financials to sync — only non-null values should be written
 */
export function extractFinancialsFromMemo(
  deal: Record<string, unknown>,
  memoContent: { sections?: MemoSection[] } | null,
): ExtractedFinancials {
  // 1. If structured columns already have non-zero values, keep them
  const existingRevenue =
    typeof deal.revenue === 'number' && deal.revenue > 0 ? deal.revenue : null;
  const existingEbitda = typeof deal.ebitda === 'number' && deal.ebitda > 0 ? deal.ebitda : null;

  if (existingRevenue && existingEbitda) {
    return { revenue: existingRevenue as number, ebitda: existingEbitda as number };
  }

  // 2. Try source quote fields
  let revenue = existingRevenue as number | null;
  let ebitda = existingEbitda as number | null;

  if (!revenue) {
    revenue = parseSourceQuote(deal.revenue_source_quote as string, 'Revenue');
  }
  if (!ebitda) {
    ebitda = parseSourceQuote(deal.ebitda_source_quote as string, 'EBITDA');
  }

  // 3. Try memo sections
  if ((!revenue || !ebitda) && memoContent?.sections) {
    const fromMemo = extractFromMemoSections(memoContent.sections);
    if (!revenue && fromMemo.revenue) revenue = fromMemo.revenue;
    if (!ebitda && fromMemo.ebitda) ebitda = fromMemo.ebitda;
  }

  return { revenue, ebitda };
}

/**
 * Sync extracted financials into the deal row and any linked marketplace listing.
 * Only writes non-null values and only if the existing value is 0 or null.
 */
export async function syncFinancialsToListings(
  supabaseAdmin: { from: (table: string) => any },
  dealId: string,
  financials: ExtractedFinancials,
): Promise<void> {
  const updates: Record<string, number> = {};
  if (financials.revenue) updates.revenue = financials.revenue;
  if (financials.ebitda) updates.ebitda = financials.ebitda;

  if (Object.keys(updates).length === 0) return;

  // Update the deal row (only if current values are 0 or null)
  // We do a conditional update: fetch current, then update if needed
  const { data: currentDeal } = await supabaseAdmin
    .from('listings')
    .select('revenue, ebitda')
    .eq('id', dealId)
    .single();

  if (currentDeal) {
    const dealUpdates: Record<string, number> = {};
    if (updates.revenue && (!currentDeal.revenue || currentDeal.revenue === 0)) {
      dealUpdates.revenue = updates.revenue;
    }
    if (updates.ebitda && (!currentDeal.ebitda || currentDeal.ebitda === 0)) {
      dealUpdates.ebitda = updates.ebitda;
    }

    if (Object.keys(dealUpdates).length > 0) {
      const { error } = await supabaseAdmin.from('listings').update(dealUpdates).eq('id', dealId);
      if (error) {
        console.error(`[memo-financials] Failed to update deal ${dealId}:`, error);
      } else {
        console.log(`[memo-financials] Synced financials to deal ${dealId}:`, dealUpdates);
      }
    }
  }

  // Update any marketplace child listing (source_deal_id = dealId)
  const { data: childListings } = await supabaseAdmin
    .from('listings')
    .select('id, revenue, ebitda')
    .eq('source_deal_id', dealId)
    .eq('is_internal_deal', false);

  if (childListings?.length) {
    for (const child of childListings) {
      const childUpdates: Record<string, number> = {};
      if (updates.revenue && (!child.revenue || child.revenue === 0)) {
        childUpdates.revenue = updates.revenue;
      }
      if (updates.ebitda && (!child.ebitda || child.ebitda === 0)) {
        childUpdates.ebitda = updates.ebitda;
      }

      if (Object.keys(childUpdates).length > 0) {
        const { error } = await supabaseAdmin
          .from('listings')
          .update(childUpdates)
          .eq('id', child.id);
        if (error) {
          console.error(`[memo-financials] Failed to update child listing ${child.id}:`, error);
        } else {
          console.log(
            `[memo-financials] Synced financials to child listing ${child.id}:`,
            childUpdates,
          );
        }
      }
    }
  }
}
