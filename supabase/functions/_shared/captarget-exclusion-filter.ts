/**
 * CapTarget Company Exclusion Filter
 *
 * Blocks non-acquisition-target companies (PE, VC, M&A advisory, investment banks,
 * family offices, search funds) from being imported as deals.
 *
 * Priority order:
 *   1. Safelist (RIA, CPA, law, consulting, insurance, services) → KEEP
 *   2. Blocklist keywords (name + description + industry text) → EXCLUDE
 *   3. Industry field (enriched label, e.g. "Private Equity") → EXCLUDE
 *   4. Company name patterns → EXCLUDE
 *   5. Title + name pattern combo → EXCLUDE
 *   6. Default → KEEP
 */

export interface ExclusionInput {
  companyName: string | null;
  description: string | null;
  contactTitle: string | null;
  industry: string | null;
}

export interface ExclusionResult {
  excluded: boolean;
  reason: string;
  category: string;
}

// ─── Safelist (checked FIRST — overrides all blocklist matches) ───

const SAFELIST: Record<string, string[]> = {
  ria_wealth: [
    "ria",
    "registered investment advisor",
    "wealth management",
    "financial planning",
    "financial advisor",
    "financial planner",
    "assets under management",
  ],
  cpa_accounting: [
    "cpa",
    "accounting",
    "accountant",
    "tax preparation",
    "bookkeeping",
    "audit services",
    "tax advisory",
  ],
  law: [
    "law firm",
    "legal services",
    "attorney",
    "litigation",
    "legal practice",
  ],
  consulting: [
    "consulting",
    "management consulting",
    "it consulting",
    "consulting firm",
    "strategy consulting",
  ],
  insurance: [
    "insurance agency",
    "insurance broker",
    "insurance brokerage",
    "benefits",
    "commercial insurance",
  ],
  service_businesses: [
    "hvac",
    "plumbing",
    "roofing",
    "healthcare",
    "dental",
    "veterinary",
    "home services",
    "landscaping",
    "electrical",
    "pest control",
    "staffing",
    "janitorial",
    "cleaning",
    "construction",
    "manufacturing",
    "restoration",
    "moving",
    "storage",
    "trucking",
    "logistics",
    "auto repair",
    "collision",
    "painting",
    "flooring",
    "paving",
    "excavation",
    "demolition",
    "environmental services",
    "waste management",
    "recycling",
    "property management",
    "real estate services",
    "medical practice",
    "physical therapy",
    "urgent care",
    "home health",
    "hospice",
    "pharmacy",
    "optometry",
    "chiropractic",
  ],
};

// ─── Blocklist keywords (checked on name + description) ───

const BLOCKLIST: Record<string, string[]> = {
  pe_buyout: [
    "private equity",
    "private investment firm",
    "investment firm",
    "buyout fund",
    "buyout firm",
    "growth equity",
    "pe firm",
    "pe fund",
    "leveraged buyout",
    "lbo",
    "portfolio company acquisition",
    "platform acquisition",
  ],
  vc: [
    "venture capital",
    "vc firm",
    "vc fund",
    "seed fund",
    "series a fund",
    "series b fund",
    "series c fund",
    "startup fund",
    "early stage fund",
    "late stage fund",
    "growth stage fund",
  ],
  ma_advisory: [
    "m&a advisory",
    "m&a advisor",
    "mergers and acquisitions",
    "sell-side advisory",
    "buy-side advisory",
    "transaction advisory",
    "deal advisory",
  ],
  investment_banking: [
    "investment bank",
    "investment banking",
    "business broker",
    "business brokerage",
    "deal origination",
    "placement agent",
    "capital markets advisory",
  ],
  family_office: [
    "family office",
    "family investment office",
    "single family office",
    "multi family office",
    "principal investing",
    "direct investing",
  ],
  search_fund: [
    "search fund",
    "fundless sponsor",
    "entrepreneurship through acquisition",
    "eta fund",
    "acquisition entrepreneur",
    "independent sponsor",
  ],
};

// ─── Company name suffix patterns ───

// Matches names ending with financial-firm suffixes
const NAME_SUFFIX_PATTERN =
  /\b(capital\s+partners|equity\s+partners|investment\s+partners|venture\s+partners|capital\s+group|capital\s+management|capital|partners|ventures|fund\s+[ivxlcdm]+|fund)\s*$/i;

// Matches "Holdings" combined with financial terms
const HOLDINGS_COMBO_PATTERN =
  /\bholdings\b.*\b(capital|investment|equity)\b|\b(capital|investment|equity)\b.*\bholdings\b/i;

// ─── Financial professional titles ───

const FINANCE_TITLES = [
  "managing partner",
  "general partner",
  "partner",
  "principal",
  "managing director",
  "vice president",
  "venture partner",
  "investment partner",
];

// ─── Helpers ───

function textContains(text: string, keyword: string): boolean {
  // Use word-boundary-aware matching for short keywords to avoid false positives
  // e.g. "cpa" shouldn't match "captarget", "ria" shouldn't match "criteria"
  if (keyword.length <= 4) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[\\s,;./(])${escaped}(?:[\\s,;./):]|$)`, "i");
    return re.test(text);
  }
  return text.includes(keyword);
}

function checkKeywords(
  text: string,
  keywords: string[]
): string | null {
  for (const kw of keywords) {
    if (textContains(text, kw)) return kw;
  }
  return null;
}

// ─── Main filter function ───

export function checkCompanyExclusion(input: ExclusionInput): ExclusionResult {
  const name = (input.companyName || "").toLowerCase().trim();
  const desc = (input.description || "").toLowerCase().trim();
  const title = (input.contactTitle || "").toLowerCase().trim();
  const industry = (input.industry || "").toLowerCase().trim();

  // Combined text for keyword searches (includes description + industry)
  const combined = `${name} ${desc} ${industry}`;

  // Nothing to check
  if (!name && !desc) {
    return { excluded: false, reason: "No company data to evaluate", category: "kept" };
  }

  // ── 1. SAFELIST CHECK (highest priority — if match, KEEP immediately) ──
  for (const [safeCategory, keywords] of Object.entries(SAFELIST)) {
    const match = checkKeywords(combined, keywords);
    if (match) {
      return {
        excluded: false,
        reason: `Safelisted (${safeCategory}): matched '${match}'`,
        category: "safelisted",
      };
    }
  }

  // ── 2. BLOCKLIST KEYWORD CHECK ──
  for (const [blockCategory, keywords] of Object.entries(BLOCKLIST)) {
    const match = checkKeywords(combined, keywords);
    if (match) {
      const categoryLabels: Record<string, string> = {
        pe_buyout: "PE/Buyout",
        vc: "Venture Capital",
        ma_advisory: "M&A Advisory",
        investment_banking: "Investment Banking",
        family_office: "Family Office",
        search_fund: "Search Fund",
      };
      return {
        excluded: true,
        reason: `${categoryLabels[blockCategory] || blockCategory}: matched '${match}'`,
        category: blockCategory,
      };
    }
  }

  // ── 3. INDUSTRY FIELD CHECK (enriched industry label) ──
  if (industry) {
    const excludedIndustries: Record<string, string> = {
      "private equity": "PE/Buyout",
      "venture capital": "Venture Capital",
      "investment banking": "Investment Banking",
      "m&a advisory": "M&A Advisory",
      "financial advisory": "M&A Advisory",
      "business brokerage": "Investment Banking",
      "hedge fund": "PE/Buyout",
    };
    for (const [industryKey, categoryLabel] of Object.entries(excludedIndustries)) {
      if (industry.includes(industryKey)) {
        return {
          excluded: true,
          reason: `Industry: "${input.industry}" matches excluded industry "${industryKey}"`,
          category: Object.keys(BLOCKLIST).find(k =>
            categoryLabel === ({
              pe_buyout: "PE/Buyout", vc: "Venture Capital", ma_advisory: "M&A Advisory",
              investment_banking: "Investment Banking", family_office: "Family Office",
              search_fund: "Search Fund",
            } as Record<string, string>)[k]
          ) || "industry_match",
        };
      }
    }
  }

  // ── 4. NAME PATTERN CHECK (company name only) ──
  if (name && NAME_SUFFIX_PATTERN.test(name)) {
    return {
      excluded: true,
      reason: `Name pattern: '${name}' ends with financial-firm suffix`,
      category: "name_pattern",
    };
  }

  if (name && HOLDINGS_COMBO_PATTERN.test(name)) {
    return {
      excluded: true,
      reason: `Name pattern: '${name}' matches Holdings + Capital/Investment/Equity`,
      category: "name_pattern",
    };
  }

  // ── 5. TITLE-SUPPORTED CHECK (title + name pattern combo) ──
  if (title && name) {
    const hasFinanceTitle = FINANCE_TITLES.some((ft) => title.includes(ft));
    const hasNamePattern = NAME_SUFFIX_PATTERN.test(name);

    if (hasFinanceTitle && hasNamePattern) {
      return {
        excluded: true,
        reason: `Title-supported: '${title}' + name pattern '${name}'`,
        category: "title_supported",
      };
    }
  }

  // ── 6. DEFAULT: KEEP ──
  return { excluded: false, reason: "No exclusion signals", category: "kept" };
}

// ─── Category labels for display ───

export const EXCLUSION_CATEGORY_LABELS: Record<string, string> = {
  pe_buyout: "PE/Buyout",
  vc: "Venture Capital",
  ma_advisory: "M&A Advisory",
  investment_banking: "Investment Banking",
  family_office: "Family Office",
  search_fund: "Search Fund",
  name_pattern: "Name Pattern",
  title_supported: "Title + Name Pattern",
  industry_match: "Industry Match",
  safelisted: "Safelisted",
  kept: "Kept",
};
