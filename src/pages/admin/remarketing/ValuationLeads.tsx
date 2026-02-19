import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCompactCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { FilterBar, TimeframeSelector, VALUATION_LEAD_FIELDS } from "@/components/filters";
import { useTimeframe } from "@/hooks/use-timeframe";
import { useFilterEngine } from "@/hooks/use-filter-engine";
import { useAdminProfiles } from "@/hooks/admin/use-admin-profiles";
import { useGlobalGateCheck, useGlobalActivityMutations } from "@/hooks/remarketing/useGlobalActivityQueue";
import { useEnrichmentProgress } from "@/hooks/useEnrichmentProgress";
import { EnrichmentProgressIndicator, DealEnrichmentSummaryDialog } from "@/components/remarketing";
import { useAuth } from "@/context/AuthContext";
import {
  Building2,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calculator,
  XCircle,
  MoreHorizontal,
  Archive,
  Users,
  Clock,
  Zap,
  Sparkles,
  ExternalLink,
  Star,
  Download,
  Trash2,
  EyeOff,
  Phone,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ───

interface ValuationLead {
  id: string;
  calculator_type: string;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  linkedin_url: string | null;
  industry: string | null;
  region: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  valuation_low: number | null;
  valuation_mid: number | null;
  valuation_high: number | null;
  quality_tier: string | null;
  quality_label: string | null;
  exit_timing: string | null;
  open_to_intros: boolean | null;
  cta_clicked: boolean | null;
  readiness_score: number | null;
  growth_trend: string | null;
  owner_dependency: string | null;
  locations_count: number | null;
  buyer_lane: string | null;
  revenue_model: string | null;
  lead_score: number | null;
  scoring_notes: string | null;
  pushed_to_all_deals: boolean | null;
  pushed_to_all_deals_at: string | null;
  pushed_listing_id: string | null;
  status: string | null;
  excluded: boolean | null;
  exclusion_reason: string | null;
  created_at: string;
  updated_at: string;
  lead_source: string | null;
  source_submission_id: string | null;
  synced_at: string | null;
  calculator_specific_data: Record<string, unknown> | null;
  raw_calculator_inputs: Record<string, unknown> | null;
  raw_valuation_results: Record<string, unknown> | null;
  // For deal owner display (assigned after push)
  deal_owner_id?: string | null;
  is_priority_target?: boolean | null;
  needs_buyer_universe?: boolean | null;
  need_to_contact_owner?: boolean | null;
  is_archived?: boolean | null;
  // Joined from listings (via pushed_listing_id) — populated by enrichment
  listing_description?: string | null;
}

type SortColumn =
  | "display_name"
  | "website"
  | "industry"
  | "location"
  | "revenue"
  | "ebitda"
  | "valuation"
  | "exit_timing"
  | "intros"
  | "quality"
  | "score"
  | "created_at"
  | "pushed"
  | "owner"
  | "priority";
type SortDirection = "asc" | "desc";

// ─── Helpers ───

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com",
  "proton.me", "icloud.com", "live.com", "yahoo.com.au", "hotmail.se",
  "bellsouth.net", "mac.com", "webxio.pro", "leabro.com", "coursora.com",
  "mail.com", "zoho.com", "yandex.com", "protonmail.com",
]);

function cleanWebsiteToDomain(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const v = raw.trim();
  if (v.includes("@")) return null;
  // Strip protocol (handles both "https://" and malformed "https:" with no slashes)
  const noProto = v.replace(/^[a-z]{2,8}:\/\//i, "").replace(/^[a-z]{2,8}:/i, "");
  const noWww = noProto.replace(/^www\./i, "");
  const domain = noWww.split("/")[0].split("?")[0].split("#")[0];
  if (!domain || !domain.includes(".")) return null;
  if (/[,\s]/.test(domain)) return null;
  if (/^(test|no|example)\./i.test(domain)) return null;
  return domain.toLowerCase();
}

const TLD_REGEX = /\.(com|net|org|io|co|ai|us|uk|ca|au|nz|ae|za|se|nl|br|fj|in|de|fr|es|it|jp|kr|mx|school|pro|app|dev|vc)(\.[a-z]{2})?$/i;

// ─── Word segmentation for concatenated domain names ───
// Dictionary of common English words + business suffixes for splitting "thebrassworksinc" → "the brass works inc"
const WORD_DICT = new Set([
  // Business suffixes
  "inc", "llc", "ltd", "corp", "co", "group", "global", "usa", "us",
  // Common business words
  "the", "and", "pro", "plus", "max", "tech", "solutions", "services",
  // Engineering & trades
  "engineer", "engineering", "engineers", "fluid", "mechanical", "electrical",
  "civil", "structural", "industrial", "chemical", "aerospace", "systems",
  "design", "designs", "designer", "designers", "build", "builds", "builder",
  "builders", "construct", "construction", "fabrication", "fabricate",
  "automation", "automate", "automated", "controls", "control", "precision",
  "technical", "technologies", "technology", "innovations", "innovation",
  "innovative", "creative", "creations", "creation", "develop", "development",
  "developers", "developer",
  "management", "consulting", "construction", "roofing", "plumbing",
  "electric", "electrical", "mechanical", "heating", "cooling", "hvac",
  "air", "auto", "automotive", "car", "cars", "motor", "motors",
  "mountain", "top", "iron", "horse", "brass", "works", "steel",
  "gold", "silver", "blue", "green", "red", "black", "white",
  "north", "south", "east", "west", "central", "pacific", "atlantic",
  "american", "national", "premier", "elite", "prime", "first", "best",
  "all", "star", "sun", "moon", "sky", "bay", "lake", "river", "rock",
  "stone", "wood", "fire", "water", "rain", "tree", "oak", "pine", "elm",
  "capital", "venture", "equity", "asset", "wealth", "financial", "finance",
  "invest", "investment", "investments", "fund", "funding", "partners",
  "partner", "advisory", "advisors", "advisor", "strategy", "strategic",
  "home", "homes", "house", "land", "lands", "property", "properties",
  "real", "estate", "build", "builder", "builders", "building",
  "design", "creative", "digital", "media", "web", "net", "online",
  "cloud", "data", "soft", "ware", "software", "systems", "system",
  "health", "care", "healthcare", "medical", "dental", "wellness",
  "food", "foods", "fresh", "organic", "natural", "clean", "pure",
  "energy", "power", "solar", "wind", "bright", "light",
  "safe", "safety", "guard", "security", "shield", "protect",
  "fast", "quick", "speed", "rapid", "express", "direct",
  "smart", "wise", "logic", "genius", "mind", "brain",
  "city", "town", "urban", "metro", "rural", "village",
  "new", "next", "future", "modern", "classic", "legacy",
  "king", "crown", "royal", "regal", "noble",
  "aquatic", "aquatics", "marine", "ocean", "sea", "coast", "coastal",
  "tropical", "collision", "body", "shop", "repair", "fix",
  "project", "foundry", "forge", "craft", "made", "custom",
  "nursery", "garden", "gardens", "lawn", "landscape", "landscaping",
  "paint", "painting", "color", "colours", "colors",
  "supply", "supplies", "source", "store", "market", "trading",
  "transport", "transportation", "freight", "logistics", "fleet",
  "print", "printing", "sign", "signs", "signage",
  "event", "events", "party", "catering", "venue",
  "sport", "sports", "fit", "fitness", "gym", "athletic",
  "pet", "pets", "vet", "veterinary", "animal", "animals",
  "spa", "salon", "beauty", "hair", "skin", "nail", "nails",
  "bar", "grill", "cafe", "coffee", "tea", "brew", "brewing",
  "farm", "farms", "ranch", "harvest", "crop", "grain",
  "school", "academy", "learning", "education", "training",
  "law", "legal", "justice", "court",
  "dental", "ortho", "vision", "eye", "eyes", "optical",
  "bon", "terra", "vita", "sol", "luna", "alta", "bella",
  "com", "compost", "vermont", "carolina", "texas", "florida",
  "boyland", "raintree",
  // Additional words for better segmentation
  "willow", "watts", "vault", "box", "clinic", "valens",
  "provider", "accreditation", "senior", "bend", "gilbert",
  "comfort", "merit", "service", "dino", "dinos",
  "glass", "line", "horizon", "fox", "hunt", "wolf", "byte",
  "clear", "pay", "gain", "gainz", "loft", "wisconsin",
  "cupola", "barn", "trace",
  "mon", "lion", "money", "coin", "gecko",
  "hub", "bubble", "price", "hoppah", "stax",
  "tesloid", "ropella", "scorpa",
  "bee", "hive", "bear", "eagle", "hawk", "falcon",
  "apex", "summit", "peak", "crest", "ridge",
  "haven", "harbor", "harbour", "port", "gate", "way",
  "link", "bridge", "path", "trail", "road",
  "tower", "point", "view", "scape",
  "micro", "macro", "mega", "nano", "multi",
  "rest", "restore", "restoration", "restorations",
  "test", "testing", "audit", "compliance",
  "pass", "flash", "dash", "rush",
  "ace", "alpha", "beta", "omega", "delta", "sigma",
  "key", "lock", "code", "cipher",
  "pilot", "captain", "chief", "lead", "guide",
  "true", "trust", "loyal", "noble", "honor",
  // Common words that were causing segmentation failures
  "bros", "bro", "brother", "brothers",
  "pros", "my", "your", "our", "his", "her", "its", "we",
  "mechanic", "mechanics",
  "made", "hand", "guy", "guys", "man", "men", "king",
  "tax", "cab", "van", "fly", "run", "hub", "bit", "log",
  "top", "pop", "hot", "big", "old",
  // Additional brand/domain words found in practice
  "sims", "funerals", "funeral", "bespoke", "kreative", "kreate",
  "kayes", "ksd", "mvp", "polka", "audio", "plumbing", "gainz",
  "willow", "legacy", "corp", "sanmora", "masource", "boyland",
  "kayesk", "tbs", "mvp", "bend", "senior", "gilbert", "comfort",
  "merit", "dino", "glass", "horizon", "vault", "provider",
  "reative", "source", "morabespoke",
  // Additional words to improve segmentation accuracy
  "legend", "voi", "gk", "gkrestoration",
  "musitechnic", "technic", "technica", "technics",
  "hoppah", "clearpay", "globall", "school", "bilingual",
  "apex", "elite", "restorations",
]);

/** Segment a concatenated string into words using dictionary-based dynamic programming. */
function segmentWords(input: string): string {
  const s = input.toLowerCase();
  const n = s.length;
  // Short strings (≤ 4 chars): treat as acronym → uppercase
  if (n <= 4) return input.toUpperCase();

  // dp[i] = best segmentation for s[0..i-1], scored by minimizing number of non-dict chunks
  const dp: { cost: number; words: string[] }[] = new Array(n + 1);
  dp[0] = { cost: 0, words: [] };

  for (let i = 1; i <= n; i++) {
    // Default: take single character (worst case)
    dp[i] = { cost: dp[i - 1].cost + 1, words: [...dp[i - 1].words, s[i - 1]] };

    for (let j = 0; j < i; j++) {
      const substr = s.slice(j, i);
      const isWord = WORD_DICT.has(substr);
      const cost = dp[j].cost + (isWord ? 0 : (substr.length <= 2 ? 2 : 1));

      // Prefer lower cost; on tie, prefer MORE words (more splits = more dict matches)
      if (cost < dp[i].cost || (cost === dp[i].cost && dp[j].words.length + 1 > dp[i].words.length)) {
        dp[i] = { cost, words: [...dp[j].words, substr] };
      }
    }
  }

  // Capitalize: dict words → Title Case, non-dict short (≤4) → UPPERCASE, non-dict long → Title Case
  return dp[n].words.map(w => {
    if (WORD_DICT.has(w)) return w.charAt(0).toUpperCase() + w.slice(1);
    if (w.length <= 4) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

/** Format a date string as a relative age: "4d ago", "2mo ago", "1y ago" */
function formatAge(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30.44);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

/** Clean a full_name username into a human-readable display string.
 *  e.g. "louis_castelli" → "Louis Castelli"
 *  Rejects usernames like "epd1112", "xiyokeh495", "jpqzancanaro"
 */
function cleanFullName(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Must have at least some letters
  if (!/[a-zA-Z]/.test(cleaned)) return null;
  // Skip pure usernames: no spaces + contains digits OR all lowercase single token with no real words
  if (!cleaned.includes(" ")) {
    // Single token — only accept if it looks like a real first name (all letters, ≥3 chars, no digits)
    if (/\d/.test(cleaned)) return null;
    // Very short or looks like a username handle — skip
    if (cleaned.length < 3) return null;
  }
  // Must have at least one letter-only word of length ≥ 2
  const words = cleaned.split(" ").filter(w => /^[a-zA-Z]{2,}$/.test(w));
  if (words.length === 0) return null;
  return toTitleCase(cleaned);
}

function isPlaceholderBusinessName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  // Generic placeholder patterns
  // Any variant of "'s Business" suffix (ASCII apostrophe, curly right quote, or any Unicode apostrophe)
  if (/[''\u2019\u02BC\u0060]s business$/i.test(lower)) return true;
  // Looks like a URL (starts with www, or is just a domain)
  if (/^www\b/i.test(lower)) return true;
  if (/\.(com|net|org|io|co|ai|us|uk|ca|au|nz|school|pro|app|dev)(\s|$)/i.test(lower)) return true;
  // Single username-like strings (no spaces, contains underscores or digits only)
  if (/^[a-z0-9_]+$/i.test(lower) && lower.includes("_")) return true;
  // All-lowercase username with numbers (e.g. "epd1112", "bcunningham4523")
  if (/^[a-z0-9]+\d+[a-z0-9]*$/i.test(lower) && !/\s/.test(lower)) return true;
  return false;
}

function extractBusinessName(lead: ValuationLead): string {
  // If the DB has a real business name (not a placeholder), use it directly
  if (lead.business_name && !isPlaceholderBusinessName(lead.business_name)) {
    const bn = lead.business_name.trim();
    // Fix mojibake apostrophes (â€™ → ') and normalize apostrophe casing (Dino'S → Dino's)
    const fixed = bn.replace(/â€™/g, "'").replace(/'([A-Z])/g, (_, c) => `'${c.toLowerCase()}`);
    // If it contains spaces, it's already well-formatted — return as-is
    if (/\s/.test(fixed)) return fixed;
    // Single word from DB — try to segment it
    const segmented = segmentWords(fixed.toLowerCase());
    if (segmented.includes(" ")) return segmented;
    return fixed;
  }
  const domain = cleanWebsiteToDomain(lead.website);
  if (domain) {
    const cleaned = domain.replace(TLD_REGEX, "");
    if (cleaned && !cleaned.match(/^(test|no|example)$/i)) {
      // Reject purely alphanumeric with digits (e.g. "tbs23", "abc123") — not a real name
      if (/^[a-z0-9]+$/i.test(cleaned) && /\d/.test(cleaned)) {
        // fall through to email/name fallback
      } else if (/[-_.]/.test(cleaned)) {
        // Has separators — just title-case
        return toTitleCase(cleaned.replace(/[-_.]/g, " "));
      } else {
        return segmentWords(cleaned);
      }
    }
  }
  if (lead.email) {
    const emailDomain = lead.email.split("@")[1]?.toLowerCase();
    if (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
      const name = emailDomain
        .split(".")[0]
        .replace(/[0-9]+$/, "")
        .replace(/[-_]/g, " ");
      if (name) {
        // If it's a single concatenated word, segment it
        if (!/\s/.test(name)) {
          return segmentWords(name);
        }
        return toTitleCase(name);
      }
    }
  }
  // Try to use full_name as a human-readable fallback before falling back to "General Calculator #N"
  const humanName = cleanFullName(lead.full_name);
  if (humanName) return humanName;
  return lead.display_name || "—";
}

function inferWebsite(lead: ValuationLead): string | null {
  const domain = cleanWebsiteToDomain(lead.website);
  if (domain) return domain;
  if (lead.email) {
    const emailDomain = lead.email.split("@")[1]?.toLowerCase();
    if (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
      return emailDomain;
    }
  }
  return null;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Build a full listing insert object from a valuation lead, preserving all valuable data.
 *  forPush=true (default) marks the listing as pushed to All Deals.
 *  forPush=false creates the listing for detail-page viewing without pushing. */
function buildListingFromLead(lead: ValuationLead, forPush = true) {
  const businessName = extractBusinessName(lead);
  const cleanDomain = inferWebsite(lead);
  const title = businessName !== "—" ? businessName : lead.full_name || "Valuation Lead";

  const motivationParts: string[] = [];
  if (lead.exit_timing === "now") motivationParts.push("Looking to exit now");
  else if (lead.exit_timing === "1-2years") motivationParts.push("Exit in 1-2 years");
  else if (lead.exit_timing === "exploring") motivationParts.push("Exploring options");
  if (lead.open_to_intros) motivationParts.push("Open to buyer introductions");

  const calcTypeLabel = lead.calculator_type === "auto_shop" ? "Auto Shop" : lead.calculator_type === "general" ? "General" : lead.calculator_type;

  const noteLines: string[] = [
    `--- Valuation Calculator Lead Intelligence ---`,
    `Source: ${calcTypeLabel} Calculator`,
    `Submitted: ${new Date(lead.created_at).toLocaleDateString()}`,
  ];

  // Contact
  if (lead.full_name) noteLines.push(`Name: ${lead.full_name}`);
  if (lead.email) noteLines.push(`Email: ${lead.email}`);
  if (lead.phone) noteLines.push(`Phone: ${lead.phone}`);
  if (lead.linkedin_url) noteLines.push(`LinkedIn: ${lead.linkedin_url}`);

  // Business
  if (lead.business_name) noteLines.push(`Business Name: ${lead.business_name}`);
  if (lead.website) noteLines.push(`Website: ${lead.website}`);
  if (lead.industry) noteLines.push(`Industry: ${lead.industry}`);
  if (lead.location) noteLines.push(`Location: ${lead.location}`);
  if (lead.locations_count != null) noteLines.push(`Number of Locations: ${lead.locations_count}`);
  if (lead.revenue_model) noteLines.push(`Revenue Model: ${lead.revenue_model}`);
  if (lead.growth_trend) noteLines.push(`Growth Trend: ${lead.growth_trend}`);

  // Financials
  if (lead.revenue != null) noteLines.push(`Revenue: $${(lead.revenue / 1e6).toFixed(2)}M`);
  if (lead.ebitda != null) noteLines.push(`EBITDA: $${lead.ebitda < 1000 ? `${lead.ebitda}K` : `${(lead.ebitda / 1e6).toFixed(2)}M`}`);
  if (lead.valuation_low != null && lead.valuation_high != null) {
    noteLines.push(`Self-Assessed Valuation: $${(lead.valuation_low / 1e6).toFixed(1)}M – $${(lead.valuation_high / 1e6).toFixed(1)}M (mid: $${((lead.valuation_mid || 0) / 1e6).toFixed(1)}M)`);
  }

  // Lead scoring
  if (lead.lead_score != null) noteLines.push(`Lead Score: ${lead.lead_score}/100`);
  if (lead.quality_label) noteLines.push(`Quality: ${lead.quality_label} (tier: ${lead.quality_tier || "—"})`);
  if (lead.readiness_score != null) noteLines.push(`Readiness: ${lead.readiness_score}/100`);
  if (lead.exit_timing) noteLines.push(`Exit Timing: ${lead.exit_timing}`);
  if (lead.open_to_intros != null) noteLines.push(`Open to Intros: ${lead.open_to_intros ? "Yes" : "No"}`);
  if (lead.owner_dependency) noteLines.push(`Owner Dependency: ${lead.owner_dependency}`);
  if (lead.buyer_lane) noteLines.push(`Buyer Lane: ${lead.buyer_lane}`);
  if (lead.cta_clicked != null) noteLines.push(`CTA Clicked: ${lead.cta_clicked ? "Yes" : "No"}`);
  if (lead.scoring_notes) noteLines.push(`Scoring Notes: ${lead.scoring_notes}`);

  // Raw calculator inputs (all key-value pairs)
  if (lead.raw_calculator_inputs && Object.keys(lead.raw_calculator_inputs).length > 0) {
    noteLines.push(`\n--- Raw Calculator Inputs ---`);
    for (const [key, val] of Object.entries(lead.raw_calculator_inputs)) {
      if (val != null && val !== "") {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        noteLines.push(`${label}: ${val}`);
      }
    }
  }

  // Raw valuation results
  if (lead.raw_valuation_results && Object.keys(lead.raw_valuation_results).length > 0) {
    noteLines.push(`\n--- Valuation Results ---`);
    for (const [key, val] of Object.entries(lead.raw_valuation_results)) {
      if (val != null && val !== "") {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        noteLines.push(`${label}: ${val}`);
      }
    }
  }

  // Calculator-specific data
  if (lead.calculator_specific_data && Object.keys(lead.calculator_specific_data).length > 0) {
    noteLines.push(`\n--- Calculator Specific Data ---`);
    for (const [key, val] of Object.entries(lead.calculator_specific_data)) {
      if (val != null && val !== "") {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        noteLines.push(`${label}: ${val}`);
      }
    }
  }

  const locationParts = lead.location?.split(",").map(s => s.trim());
  const address_city = locationParts?.[0] || null;
  const address_state = locationParts?.[1]?.length === 2 ? locationParts[1] : null;

  return {
    title,
    internal_company_name: title,
    deal_source: "valuation_calculator",
    deal_identifier: `vlead_${lead.id.slice(0, 8)}`,
    status: "active",
    is_internal_deal: true,
    pushed_to_all_deals: forPush,
    ...(forPush ? { pushed_to_all_deals_at: new Date().toISOString() } : {}),
    main_contact_name: lead.full_name || null,
    main_contact_email: lead.email || null,
    main_contact_phone: lead.phone || null,
    website: cleanDomain ? `https://${cleanDomain}` : null,
    linkedin_url: lead.linkedin_url || null,
    industry: lead.industry || null,
    location: lead.location || null,
    address_city,
    address_state,
    revenue: lead.revenue,
    ebitda: lead.ebitda,
    revenue_model: lead.revenue_model || null,
    growth_trajectory: lead.growth_trend || null,
    number_of_locations: lead.locations_count || null,
    seller_motivation: motivationParts.join(". ") || null,
    owner_goals: lead.exit_timing ? `Exit timing: ${lead.exit_timing}${lead.open_to_intros ? ". Open to buyer introductions." : ""}` : null,
    internal_notes: noteLines.join("\n"),
    deal_owner_id: lead.deal_owner_id || null,
  } as never;
}

const QUALITY_ORDER: Record<string, number> = {
  "Very Strong": 4,
  "Solid": 3,
  "Average": 2,
  "Needs Work": 1,
};

function scorePillClass(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-blue-100 text-blue-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  if (score >= 20) return "bg-orange-100 text-orange-800";
  return "bg-muted text-muted-foreground";
}

function exitTimingBadge(timing: string | null) {
  if (!timing) return null;
  const config: Record<string, { label: string; className: string }> = {
    now: { label: "Exit Now", className: "bg-red-50 text-red-700 border-red-200" },
    "1-2years": { label: "1-2 Years", className: "bg-amber-50 text-amber-700 border-amber-200" },
    exploring: { label: "Exploring", className: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const c = config[timing] || { label: timing, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", c.className)}>
      {c.label}
    </Badge>
  );
}

function qualityBadge(label: string | null) {
  if (!label) return null;
  const config: Record<string, string> = {
    "Very Strong": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Strong": "bg-teal-50 text-teal-700 border-teal-200",
    "Solid": "bg-blue-50 text-blue-700 border-blue-200",
    "Average": "bg-amber-50 text-amber-700 border-amber-200",
    "Needs Work": "bg-red-50 text-red-700 border-red-200",
  };
  const cls = config[label] || "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", cls)}>
      {label}
    </Badge>
  );
}

function calculatorBadge(type: string) {
  const config: Record<string, { label: string; className: string }> = {
    general: { label: "General", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    auto_shop: { label: "Auto Shop", className: "bg-blue-50 text-blue-700 border-blue-200" },
    hvac: { label: "HVAC", className: "bg-orange-50 text-orange-700 border-orange-200" },
    collision: { label: "Collision", className: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  const c = config[type] || { label: type.replace(/_/g, " "), className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0", c.className)}>
      {c.label}
    </Badge>
  );
}

function exportLeadsToCSV(leads: ValuationLead[]) {
  const headers = [
    "Business Name", "Contact Name", "Email", "Phone", "Website",
    "Industry", "Location", "Revenue", "EBITDA",
    "Valuation Low", "Valuation Mid", "Valuation High",
    "Lead Score", "Quality", "Exit Timing", "Open to Intros",
    "Calculator Type", "Status", "Pushed", "Pushed At", "Created At",
  ];
  const rows = leads.map(l => [
    extractBusinessName(l),
    l.full_name || "",
    l.email || "",
    l.phone || "",
    inferWebsite(l) || "",
    l.industry || "",
    l.location || "",
    l.revenue ?? "",
    l.ebitda ?? "",
    l.valuation_low ?? "",
    l.valuation_mid ?? "",
    l.valuation_high ?? "",
    l.lead_score ?? "",
    l.quality_label || "",
    l.exit_timing || "",
    l.open_to_intros != null ? (l.open_to_intros ? "Yes" : "No") : "",
    l.calculator_type,
    l.status || "",
    l.pushed_to_all_deals ? "Yes" : "No",
    l.pushed_to_all_deals_at ? format(new Date(l.pushed_to_all_deals_at), "yyyy-MM-dd") : "",
    format(new Date(l.created_at), "yyyy-MM-dd"),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `valuation-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───

export default function ValuationLeads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { completeOperation, updateProgress } = useGlobalActivityMutations();

  // Admin profiles for deal owner display
  const { data: adminProfiles } = useAdminProfiles();

  // Enrichment progress tracking (same as CapTarget / GP Partners / All Deals)
  const {
    progress: enrichmentProgress,
    summary: enrichmentSummary,
    showSummary: showEnrichmentSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  } = useEnrichmentProgress();

  // Calculator type tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Timeframe (standardized hook)
  const { timeframe, setTimeframe, isInRange } = useTimeframe("all_time");

  // Sorting – persisted in URL so navigating back restores the sort
  const [searchParams, setSearchParams] = useSearchParams();
  const sortColumn = (searchParams.get("sort") as SortColumn) ?? "created_at";
  const sortDirection = (searchParams.get("dir") as SortDirection) ?? "desc";

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hide pushed toggle
  const [hidePushed, setHidePushed] = useState(false);

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Column resizing
  const DEFAULT_COL_WIDTHS: Record<string, number> = {
    company: 160,
    description: 200,
    calculator: 110,
    industry: 130,
    location: 110,
    owner: 130,
    revenue: 90,
    ebitda: 90,
    valuation: 100,
    exit: 80,
    intros: 70,
    quality: 80,
    score: 65,
    added: 90,
    status: 90,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS);

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 120;
      const onMouseMove = (mv: MouseEvent) => {
        const newW = Math.max(60, startW + mv.clientX - startX);
        setColWidths((prev) => ({ ...prev, [col]: newW }));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths]
  );

  // Action states
  const [isPushing, setIsPushing] = useState(false);
  const [isPushEnriching, setIsPushEnriching] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  // Fetch valuation leads
  const {
    data: leads,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["remarketing", "valuation-leads"],
    refetchOnMount: "always",
    staleTime: 30_000,
    queryFn: async () => {
      const allData: ValuationLead[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("valuation_leads")
          .select("*, listings!valuation_leads_pushed_listing_id_fkey(description, executive_summary)")
          .eq("excluded", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized = (data as any[]).map((row) => ({
            ...row,
            listing_description: row.listings?.description || row.listings?.executive_summary || null,
            listings: undefined, // strip the join object
            revenue: row.revenue != null ? Number(row.revenue) : null,
            ebitda: row.ebitda != null ? Number(row.ebitda) : null,
            valuation_low: row.valuation_low != null ? Number(row.valuation_low) : null,
            valuation_mid: row.valuation_mid != null ? Number(row.valuation_mid) : null,
            valuation_high: row.valuation_high != null ? Number(row.valuation_high) : null,
            lead_score: row.lead_score != null ? Number(row.lead_score) : null,
            readiness_score: row.readiness_score != null ? Number(row.readiness_score) : null,
            locations_count: row.locations_count != null ? Number(row.locations_count) : null,
          }));
          allData.push(...normalized);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Get distinct calculator types for tabs — always include "general" first
  const calculatorTypes = useMemo(() => {
    if (!leads) return ["general"];
    const types = new Set(leads.map((l) => l.calculator_type));
    types.add("general"); // always show general tab
    // Sort: general first, then rest alphabetically
    return Array.from(types).sort((a, b) => {
      if (a === "general") return -1;
      if (b === "general") return 1;
      return a.localeCompare(b);
    });
  }, [leads]);

  // Filter engine for advanced filtering
  const {
    filteredItems: engineFiltered,
    filterState,
    setFilterState,
    activeFilterCount,
    dynamicOptions,
    filteredCount,
    totalCount: engineTotal,
  } = useFilterEngine(leads ?? [], VALUATION_LEAD_FIELDS);

  // Default filter: "Website is not empty" — applied on first mount if no filter is already set
  useEffect(() => {
    if (filterState.rules.length === 0) {
      setFilterState((prev) => ({
        ...prev,
        conjunction: "and",
        rules: [{ id: "default-website-filter", field: "website", operator: "is_not_empty", value: "" }],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  // Apply tab + timeframe on top of engine-filtered results, then sort
  const filteredLeads = useMemo(() => {
    let filtered = engineFiltered;

    // Hide archived leads by default
    filtered = filtered.filter((l) => !l.is_archived);

    // Hide pushed if toggle is on
    if (hidePushed) filtered = filtered.filter((l) => !l.pushed_to_all_deals);

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((l) => l.calculator_type === activeTab);
    }

    // Timeframe filter
    filtered = filtered.filter((l) => isInRange(l.created_at));

    // Deduplicate by normalized domain — keep the best record per website
    // (highest lead_score, or most recent if tied)
    const domainMap = new Map<string, ValuationLead>();
    for (const lead of filtered) {
      const domain = cleanWebsiteToDomain(lead.website);
      const key = domain ?? `__no_domain_${lead.id}`;
      const existing = domainMap.get(key);
      if (!existing) {
        domainMap.set(key, lead);
      } else {
        const existingScore = existing.lead_score ?? -1;
        const newScore = lead.lead_score ?? -1;
        const existingDate = existing.created_at ?? "";
        const newDate = lead.created_at ?? "";
        // Prefer higher score; on tie prefer more recent
        if (newScore > existingScore || (newScore === existingScore && newDate > existingDate)) {
          domainMap.set(key, lead);
        }
      }
    }
    filtered = Array.from(domainMap.values());

    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "display_name":
          valA = extractBusinessName(a).toLowerCase();
          valB = extractBusinessName(b).toLowerCase();
          break;
        case "website":
          valA = (inferWebsite(a) || "").toLowerCase();
          valB = (inferWebsite(b) || "").toLowerCase();
          break;
        case "industry":
          valA = (a.industry || "").toLowerCase();
          valB = (b.industry || "").toLowerCase();
          break;
        case "location":
          valA = (a.location || "").toLowerCase();
          valB = (b.location || "").toLowerCase();
          break;
        case "revenue":
          valA = a.revenue ?? -1;
          valB = b.revenue ?? -1;
          break;
        case "ebitda":
          valA = a.ebitda ?? -1;
          valB = b.ebitda ?? -1;
          break;
        case "valuation":
          valA = a.valuation_mid ?? -1;
          valB = b.valuation_mid ?? -1;
          break;
        case "exit_timing": {
          const timingOrder: Record<string, number> = { now: 3, "1-2years": 2, exploring: 1 };
          valA = timingOrder[a.exit_timing || ""] ?? 0;
          valB = timingOrder[b.exit_timing || ""] ?? 0;
          break;
        }
        case "intros":
          valA = a.open_to_intros ? 1 : 0;
          valB = b.open_to_intros ? 1 : 0;
          break;
        case "quality":
          // Sort by quality tier order, not readiness_score
          valA = QUALITY_ORDER[a.quality_label || ""] ?? 0;
          valB = QUALITY_ORDER[b.quality_label || ""] ?? 0;
          break;
        case "score":
          valA = a.lead_score ?? -1;
          valB = b.lead_score ?? -1;
          break;
        case "created_at":
          valA = a.created_at || "";
          valB = b.created_at || "";
          break;
        case "pushed":
          valA = a.pushed_to_all_deals ? 1 : 0;
          valB = b.pushed_to_all_deals ? 1 : 0;
          break;
        case "priority":
          valA = a.is_priority_target ? 1 : 0;
          valB = b.is_priority_target ? 1 : 0;
          break;
        case "owner": {
          const ownerA = a.deal_owner_id ? (adminProfiles?.[a.deal_owner_id]?.displayName || "") : "";
          const ownerB = b.deal_owner_id ? (adminProfiles?.[b.deal_owner_id]?.displayName || "") : "";
          valA = ownerA.toLowerCase();
          valB = ownerB.toLowerCase();
          break;
        }
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [engineFiltered, activeTab, isInRange, sortColumn, sortDirection, adminProfiles, hidePushed]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  // Reset page and clear selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, timeframe, sortColumn, sortDirection, filterState]);

  const handleSort = (col: SortColumn) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("sort") === col) {
        next.set("dir", next.get("dir") === "asc" ? "desc" : "asc");
      } else {
        next.set("sort", col);
        next.set("dir", "asc");
      }
      return next;
    }, { replace: true });
  };

  // Selection helpers
  const allSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Row click handler — navigate to deal detail for every lead.
  // Auto-creates a listing (without pushing) if one doesn't exist yet.
  const handleRowClick = useCallback(
    async (lead: ValuationLead) => {
      if (lead.pushed_listing_id) {
        navigate('/admin/remarketing/deals/' + lead.pushed_listing_id, {
          state: { from: "/admin/remarketing/valuation-leads" },
        });
        return;
      }

      const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;

      // Check if a listing was already created for this lead (e.g. from a previous click)
      // to avoid hitting the unique constraint on deal_identifier
      const { data: existing } = await supabase
        .from("listings")
        .select("id")
        .eq("deal_identifier", dealIdentifier)
        .maybeSingle();

      let listingId: string;

      if (existing?.id) {
        // Reuse the existing listing and heal the missing pushed_listing_id link
        listingId = existing.id;
        await supabase
          .from("valuation_leads")
          .update({ pushed_listing_id: listingId } as never)
          .eq("id", lead.id);
      } else {
        // Auto-create a listing so the detail page works (not pushed to All Deals)
        const { data: listing, error: insertError } = await supabase
          .from("listings")
          .insert(buildListingFromLead(lead, false))
          .select("id")
          .single();

        if (insertError || !listing) {
          console.error("Failed to create listing for lead:", lead.id, insertError);
          sonnerToast.error("Failed to open deal page");
          return;
        }

        listingId = listing.id;

        // Save the listing reference on the valuation lead
        await supabase
          .from("valuation_leads")
          .update({ pushed_listing_id: listingId } as never)
          .eq("id", lead.id);
      }

      // Refresh so the table shows the updated listing_id
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });

      navigate('/admin/remarketing/deals/' + listingId, {
        state: { from: "/admin/remarketing/valuation-leads" },
      });
    },
    [navigate, queryClient]
  );

  // Push to All Deals — handles leads with or without an existing listing
  const handlePushToAllDeals = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0 || isPushing) return;
      setIsPushing(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);

      let successCount = 0;
      let errorCount = 0;
      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          // Listing already exists (auto-created on row click) — just mark as pushed
          const { error } = await supabase
            .from("listings")
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq("id", listingId);
          if (error) { console.error("Failed to update listing:", error); errorCount++; continue; }
        } else {
          // No listing yet — create one marked as pushed
          const { data: listing, error: insertError } = await supabase
            .from("listings")
            .insert(buildListingFromLead(lead, true))
            .select("id")
            .single();
          if (insertError || !listing) { console.error("Failed to create listing:", insertError); errorCount++; continue; }
          listingId = listing.id;
        }

        const { error: updateError } = await supabase
          .from("valuation_leads")
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: "pushed",
          } as never)
          .eq("id", lead.id);

        if (updateError) {
          console.error("Listing created but failed to mark lead as pushed:", lead.id, updateError);
        }

        successCount++;
      }

      setIsPushing(false);
      setSelectedIds(new Set());

      if (successCount > 0) {
        sonnerToast.success(`Added ${successCount} lead${successCount !== 1 ? "s" : ""} to All Deals${errorCount > 0 ? ` (${errorCount} failed)` : ""}`);
      } else {
        sonnerToast.info("Nothing to add — selected leads are already in All Deals.");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, isPushing, queryClient]
  );

  // Push & Enrich — handles leads with or without an existing listing
  const handlePushAndEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsPushEnriching(true);

      const leadsToProcess = (leads || []).filter((l) => leadIds.includes(l.id) && !l.pushed_to_all_deals);
      if (!leadsToProcess.length) {
        sonnerToast.info("No unpushed leads selected");
        setIsPushEnriching(false);
        return;
      }

      let pushed = 0;
      let enrichQueued = 0;
      const listingIds: string[] = [];

      for (const lead of leadsToProcess) {
        let listingId = lead.pushed_listing_id;

        if (listingId) {
          // Listing already exists — mark as pushed
          const { error } = await supabase
            .from("listings")
            .update({ pushed_to_all_deals: true, pushed_to_all_deals_at: new Date().toISOString() })
            .eq("id", listingId);
          if (error) { console.error("Failed to update listing:", error); continue; }
        } else {
          const { data: listing, error: insertError } = await supabase
            .from("listings")
            .insert(buildListingFromLead(lead, true))
            .select("id")
            .single();
          if (insertError || !listing) { console.error("Failed to create listing:", insertError); continue; }
          listingId = listing.id;
        }

        listingIds.push(listingId);

        await supabase
          .from("valuation_leads")
          .update({
            pushed_to_all_deals: true,
            pushed_to_all_deals_at: new Date().toISOString(),
            pushed_listing_id: listingId,
            status: "pushed",
          } as never)
          .eq("id", lead.id);

        pushed++;
      }

      // Queue all pushed listings for enrichment (chunked, matching CapTarget pattern)
      if (listingIds.length > 0) {
        // Register with global activity queue
        let activityItem: { id: string } | null = null;
        try {
          const result = await startOrQueueMajorOp({
            operationType: "deal_enrichment",
            totalItems: listingIds.length,
            description: `Push & enrich ${listingIds.length} valuation leads`,
            userId: user?.id || "",
            contextJson: { source: "valuation_leads_push_enrich" },
          });
          activityItem = result.item;
        } catch {
          // Non-blocking
        }

        const now = new Date().toISOString();
        const rows = listingIds.map((id) => ({
          listing_id: id,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
        }));

        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabase
            .from("enrichment_queue")
            .upsert(chunk, { onConflict: "listing_id" });
          if (!error) enrichQueued += chunk.length;
          else {
            console.error("Queue upsert error:", error);
            if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          }
        }

        // Trigger the enrichment worker (non-blocking, read results for progress)
        try {
          const { data: result } = await supabase.functions.invoke("process-enrichment-queue", {
            body: { source: "valuation_leads_push_enrich" },
          });
          if (result?.synced > 0 || result?.processed > 0) {
            const totalDone = (result?.synced || 0) + (result?.processed || 0);
            if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          }
        } catch {
          // Non-blocking — enrichment progress hook will track completion via polling
        }
      }

      setIsPushEnriching(false);
      setSelectedIds(new Set());

      if (pushed > 0) {
        sonnerToast.success(`Added ${pushed} lead${pushed !== 1 ? "s" : ""} to All Deals and queued ${enrichQueued} for enrichment`);
      } else {
        sonnerToast.info("Select leads that haven't been added to All Deals yet.");
      }

      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Re-Enrich selected — re-queues already-pushed leads (matching CapTarget handleEnrichSelected)
  const handleReEnrich = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) return;
      setIsReEnriching(true);

      const leadsToProcess = (leads || []).filter(
        (l) => leadIds.includes(l.id) && l.pushed_to_all_deals && l.pushed_listing_id
      );

      if (!leadsToProcess.length) {
        sonnerToast.info("No pushed leads with listing IDs found");
        setIsReEnriching(false);
        return;
      }

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: leadsToProcess.length,
          description: `Re-enriching ${leadsToProcess.length} valuation leads`,
          userId: user?.id || "",
          contextJson: { source: "valuation_leads_re_enrich" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = leadsToProcess
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
          force: true,
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id" });
        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error("Failed to queue enrichment");
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsReEnriching(false);
          return;
        }
      }

      if (rows.length > 0) {
        sonnerToast.success(`Re-queued ${rows.length} lead${rows.length !== 1 ? "s" : ""} for enrichment`);
      } else {
        sonnerToast.info("No leads in All Deals found to re-enrich");
      }
      setSelectedIds(new Set());

      setIsReEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Archive selected leads (soft-delete, hidden from default view)
  const handleArchive = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    const { error } = await supabase
      .from("valuation_leads")
      .update({ is_archived: true } as never)
      .in("id", leadIds);
    if (error) {
      sonnerToast.error("Failed to archive leads");
      return;
    }
    sonnerToast.success(`Archived ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""}`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
  }, [queryClient]);

  // Enrich All — auto-creates listings for leads that don't have one yet, then queues all for enrichment
  const handleBulkEnrich = useCallback(
    async (mode: "unenriched" | "all") => {
      const allLeads = leads || [];

      // All leads that have a website (they can be enriched)
      const leadsWithWebsite = allLeads.filter((l) => !!inferWebsite(l));

      // For "unenriched" mode, only process leads that haven't been enriched yet
      const enrichableLeads = mode === "unenriched"
        ? leadsWithWebsite.filter((l) => !l.pushed_listing_id)
        : leadsWithWebsite;

      if (!enrichableLeads.length) {
        sonnerToast.info(mode === "unenriched" ? "All leads have already been enriched" : "No leads with websites to enrich");
        return;
      }

      setIsEnriching(true);

      // Step 1: Auto-create listings only for leads that don't have one yet
      const leadsNeedingListing = enrichableLeads.filter((l) => !l.pushed_listing_id);
      if (leadsNeedingListing.length > 0) {
        sonnerToast.info(`Creating listings for ${leadsNeedingListing.length} leads...`);
        const LISTING_BATCH = 50;
        for (let i = 0; i < leadsNeedingListing.length; i += LISTING_BATCH) {
          const batch = leadsNeedingListing.slice(i, i + LISTING_BATCH);
          await Promise.all(
            batch.map(async (lead) => {
              try {
                const dealIdentifier = `vlead_${lead.id.slice(0, 8)}`;
                // Check if listing already exists
                const { data: existing } = await supabase
                  .from("listings")
                  .select("id")
                  .eq("deal_identifier", dealIdentifier)
                  .maybeSingle();

                let listingId: string;
                if (existing?.id) {
                  listingId = existing.id;
                } else {
                  const { data: listing, error: insertError } = await supabase
                    .from("listings")
                    .insert(buildListingFromLead(lead, false))
                    .select("id")
                    .single();
                  if (insertError || !listing) return;
                  listingId = listing.id;
                }
                // Save the listing reference back to the lead
                await supabase
                  .from("valuation_leads")
                  .update({ pushed_listing_id: listingId } as never)
                  .eq("id", lead.id);
                // Update in-memory so queue step picks it up
                lead.pushed_listing_id = listingId;
              } catch {
                // Non-blocking per-lead
              }
            })
          );
        }
      }

      // Step 2: Collect all listing IDs (now including newly created ones)
      const targets = enrichableLeads.filter((l) => !!l.pushed_listing_id);

      let activityItem: { id: string } | null = null;
      try {
        const result = await startOrQueueMajorOp({
          operationType: "deal_enrichment",
          totalItems: targets.length,
          description: `Enriching ${targets.length} valuation lead listings`,
          userId: user?.id || "",
          contextJson: { source: "valuation_leads_bulk" },
        });
        activityItem = result.item;
      } catch {
        // Non-blocking
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = targets
        .filter((l) => {
          if (!l.pushed_listing_id || seen.has(l.pushed_listing_id)) return false;
          seen.add(l.pushed_listing_id!);
          return true;
        })
        .map((l) => ({
          listing_id: l.pushed_listing_id!,
          status: "pending" as const,
          attempts: 0,
          queued_at: now,
          force: mode === "all",
          completed_at: null,
          last_error: null,
          started_at: null,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const listingIds = chunk.map((r) => r.listing_id);

        // First: reset any existing rows so force/status/attempts are always overwritten
        const { error: updateError } = await supabase
          .from("enrichment_queue")
          .update({
            status: "pending",
            force: mode === "all",
            attempts: 0,
            queued_at: now,
            completed_at: null,
            last_error: null,
            started_at: null,
          })
          .in("listing_id", listingIds);

        if (updateError) console.warn("Queue pre-update error (non-fatal):", updateError);

        // Then: insert rows that don't exist yet (upsert will skip existing due to prior update)
        const { error } = await supabase
          .from("enrichment_queue")
          .upsert(chunk, { onConflict: "listing_id", ignoreDuplicates: true });

        if (error) {
          console.error("Queue upsert error:", error);
          sonnerToast.error(`Failed to queue enrichment (batch ${Math.floor(i / CHUNK) + 1})`);
          if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "failed" });
          setIsEnriching(false);
          return;
        }
      }

      sonnerToast.success(`Queued ${rows.length} lead${rows.length !== 1 ? "s" : ""} in All Deals for enrichment`);

      // Trigger the enrichment worker and handle results (matching CapTarget pattern)
      try {
        const { data: result } = await supabase.functions.invoke("process-enrichment-queue", {
          body: { source: "valuation_leads_bulk" },
        });
        if (result?.synced > 0 || result?.processed > 0) {
          const totalDone = (result?.synced || 0) + (result?.processed || 0);
          if (activityItem) updateProgress.mutate({ id: activityItem.id, completedItems: totalDone });
          if (result?.processed === 0) {
            sonnerToast.success(`All ${result.synced} deals were already enriched`);
            if (activityItem) completeOperation.mutate({ id: activityItem.id, finalStatus: "completed" });
          }
        }
      } catch {
        // Non-blocking — enrichment progress hook will track completion via polling
      }

      setIsEnriching(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [leads, user, startOrQueueMajorOp, completeOperation, updateProgress, queryClient]
  );

  // Retry failed enrichment (matching All Deals pattern)
  const handleRetryFailedEnrichment = useCallback(async () => {
    dismissSummary();
    if (!enrichmentSummary?.errors.length) return;
    const failedIds = enrichmentSummary.errors.map((e) => e.listingId);
    const nowIso = new Date().toISOString();
    await supabase
      .from("enrichment_queue")
      .update({ status: "pending", attempts: 0, last_error: null, queued_at: nowIso })
      .in("listing_id", failedIds);
    sonnerToast.success(
      `Retrying ${failedIds.length} failed deal${failedIds.length !== 1 ? "s" : ""}`
    );
    void supabase.functions
      .invoke("process-enrichment-queue", { body: { source: "valuation_leads_retry" } })
      .catch(console.warn);
  }, [dismissSummary, enrichmentSummary]);

  // Score leads
  const handleScoreLeads = useCallback(
    async (mode: "unscored" | "all") => {
      const targets = mode === "unscored"
        ? filteredLeads.filter((l) => l.lead_score == null)
        : filteredLeads;

      if (!targets.length) {
        sonnerToast.info("No leads to score");
        return;
      }

      setIsScoring(true);
      sonnerToast.info(`Scoring ${targets.length} leads...`);

      try {
        const { data, error } = await supabase.functions.invoke("calculate-valuation-lead-score", {
          body: { mode },
        });

        if (error) throw error;

        sonnerToast.success(`Scored ${data?.scored ?? targets.length} leads`);
      } catch (err) {
        console.error("Scoring failed:", err);
        sonnerToast.error("Scoring failed");
      }

      setIsScoring(false);
      queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
    },
    [filteredLeads, queryClient]
  );

  // Assign deal owner to valuation lead (and synced listing if pushed)
  const handleAssignOwner = useCallback(async (lead: ValuationLead, ownerId: string | null) => {
    // Always update the valuation_leads row
    const { error } = await supabase
      .from("valuation_leads")
      .update({ deal_owner_id: ownerId })
      .eq("id", lead.id);
    if (error) {
      sonnerToast.error("Failed to update owner");
      return;
    }
    // Also update the pushed listing if one exists
    if (lead.pushed_listing_id) {
      await supabase
        .from("listings")
        .update({ deal_owner_id: ownerId })
        .eq("id", lead.pushed_listing_id);
    }
    sonnerToast.success(ownerId ? "Owner assigned" : "Owner removed");
    queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
  }, [queryClient]);

  // KPI Stats (based on current view: tab + timeframe + filters)
  const kpiStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const openToIntros = filteredLeads.filter((l) => l.open_to_intros === true).length;
    const exitNow = filteredLeads.filter((l) => l.exit_timing === "now").length;
    const pushedCount = filteredLeads.filter((l) => l.pushed_to_all_deals === true).length;
    const avgScore = filteredLeads.length > 0
      ? Math.round(filteredLeads.reduce((sum, l) => sum + (l.lead_score ?? 0), 0) / filteredLeads.length)
      : 0;

    return { totalLeads, openToIntros, exitNow, pushedCount, avgScore };
  }, [filteredLeads]);

  const totalLeads = leads?.length || 0;
  const unscoredCount = leads?.filter((l) => l.lead_score == null).length || 0;
  const pushedTotal = leads?.filter((l) => l.pushed_to_all_deals).length || 0;

  const SortHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortColumn === column ? "text-foreground" : "text-muted-foreground/50"
        )}
      />
    </button>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Valuation Calculator Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalLeads} total &middot; {unscoredCount} unscored &middot; {pushedTotal} in All Deals
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Enrich All Pushed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isEnriching}>
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Enrich
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkEnrich("unenriched")}>
                Enrich Unenriched
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkEnrich("all")}>
                Re-enrich All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Score */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isScoring}>
                {isScoring ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-1" />
                )}
                Score
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleScoreLeads("unscored")}>
                Score Unscored
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScoreLeads("all")}>
                Recalculate All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timeframe selector */}
          <TimeframeSelector value={timeframe} onChange={setTimeframe} compact />
        </div>
      </div>

      {/* Calculator Type Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "all"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          All Types
        </button>
        {calculatorTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === type
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {type === "general" ? "General" : type === "auto_shop" ? "Auto Shop" : type.replace(/_/g, " ")}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({(leads || []).filter((l) => l.calculator_type === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{kpiStats.totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open to Intros</p>
                <p className="text-2xl font-bold text-blue-600">{kpiStats.openToIntros}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exit Now</p>
                <p className="text-2xl font-bold text-red-600">{kpiStats.exitNow}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Added to All Deals</p>
                <p className="text-2xl font-bold text-green-600">{kpiStats.pushedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filterState={filterState}
        onFilterStateChange={setFilterState}
        fieldDefinitions={VALUATION_LEAD_FIELDS}
        dynamicOptions={dynamicOptions}
        totalCount={engineTotal}
        filteredCount={filteredCount}
      />

      {/* Hide Pushed Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHidePushed(h => !h)}
          className={cn(
            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors",
            hidePushed
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hidePushed ? "Showing Un-Pushed Only" : "Hide Pushed"}
        </button>
      </div>

      {/* Enrichment Progress Bar (matching CapTarget / GP Partners / All Deals) */}
      {(enrichmentProgress.isEnriching || enrichmentProgress.isPaused) && (
        <EnrichmentProgressIndicator
          completedCount={enrichmentProgress.completedCount}
          totalCount={enrichmentProgress.totalCount}
          progress={enrichmentProgress.progress}
          estimatedTimeRemaining={enrichmentProgress.estimatedTimeRemaining}
          processingRate={enrichmentProgress.processingRate}
          successfulCount={enrichmentProgress.successfulCount}
          failedCount={enrichmentProgress.failedCount}
          isPaused={enrichmentProgress.isPaused}
          onPause={pauseEnrichment}
          onResume={resumeEnrichment}
          onCancel={cancelEnrichment}
        />
      )}

      {/* Deal Enrichment Summary Dialog */}
      <DealEnrichmentSummaryDialog
        open={showEnrichmentSummary}
        onOpenChange={(open) => !open && dismissSummary()}
        summary={enrichmentSummary}
        onRetryFailed={handleRetryFailedEnrichment}
      />

      {/* Bulk Actions (selection-based) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedIds.size} selected
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <XCircle className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePushToAllDeals(Array.from(selectedIds))}
            disabled={isPushing || isPushEnriching}
            className="gap-2"
          >
            {isPushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Push to All Deals
          </Button>
          <Button
            size="sm"
            onClick={() => handlePushAndEnrich(Array.from(selectedIds))}
            disabled={isPushEnriching || isPushing}
            className="gap-2"
          >
            {isPushEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Push &amp; Enrich
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleReEnrich(Array.from(selectedIds))}
            disabled={isReEnriching}
            className="gap-2"
          >
            {isReEnriching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Re-Enrich Pushed
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const selected = filteredLeads.filter((l) => selectedIds.has(l.id));
              exportLeadsToCSV(selected);
            }}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleArchive(Array.from(selectedIds))}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      )}

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: colWidths.company }} />
                <col style={{ width: colWidths.description }} />
                {activeTab === "all" && <col style={{ width: colWidths.calculator }} />}
                <col style={{ width: colWidths.industry }} />
                <col style={{ width: colWidths.location }} />
                <col style={{ width: colWidths.owner }} />
                <col style={{ width: colWidths.revenue }} />
                <col style={{ width: colWidths.ebitda }} />
                <col style={{ width: colWidths.valuation }} />
                <col style={{ width: colWidths.exit }} />
                <col style={{ width: colWidths.intros }} />
                <col style={{ width: colWidths.quality }} />
                <col style={{ width: colWidths.score }} />
                <col style={{ width: colWidths.added }} />
                <col style={{ width: colWidths.status }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[40px] text-center text-muted-foreground">#</TableHead>
                  {(["company","description"] as const).map((col, i) => (
                    <TableHead key={col} className="relative overflow-visible" style={{ width: colWidths[col] }}>
                      {col === "company" ? <SortHeader column="display_name">Company</SortHeader> : "Description"}
                      <div onMouseDown={(e) => startResize(col, e)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10" />
                    </TableHead>
                  ))}
                  {activeTab === "all" && (
                    <TableHead className="relative overflow-visible" style={{ width: colWidths.calculator }}>
                      Calculator
                      <div onMouseDown={(e) => startResize("calculator", e)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10" />
                    </TableHead>
                  )}
                  {(["industry","location","owner","revenue","ebitda","valuation","exit","intros","quality","score","added","status","priority"] as const).map((col) => (
                    <TableHead key={col} className="relative overflow-visible" style={{ width: colWidths[col], textAlign: ["revenue","ebitda","valuation"].includes(col) ? "right" : ["intros","priority"].includes(col) ? "center" : undefined }}>
                      {col === "industry" && <SortHeader column="industry">Industry</SortHeader>}
                      {col === "location" && <SortHeader column="location">Location</SortHeader>}
                      {col === "owner" && <SortHeader column="owner">Deal Owner</SortHeader>}
                      {col === "revenue" && <SortHeader column="revenue">Revenue</SortHeader>}
                      {col === "ebitda" && <SortHeader column="ebitda">EBITDA</SortHeader>}
                      {col === "valuation" && <SortHeader column="valuation">Valuation</SortHeader>}
                      {col === "exit" && <SortHeader column="exit_timing">Exit</SortHeader>}
                      {col === "intros" && <SortHeader column="intros">Intros</SortHeader>}
                      {col === "quality" && <SortHeader column="quality">Quality</SortHeader>}
                      {col === "score" && <SortHeader column="score">Score</SortHeader>}
                      {col === "added" && <SortHeader column="created_at">Added</SortHeader>}
                      {col === "status" && <SortHeader column="pushed">Status</SortHeader>}
                      {col === "priority" && <SortHeader column="priority">Priority</SortHeader>}
                      <div onMouseDown={(e) => startResize(col, e)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10" />
                    </TableHead>
                  ))}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={activeTab === "all" ? 17 : 16}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium">No valuation calculator leads yet</p>
                      <p className="text-sm mt-1">
                        Leads will appear here when submitted through SourceCo calculators.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeads.map((lead, idx) => (
                    <TableRow
                      key={lead.id}
                      className={cn(
                        "transition-colors cursor-pointer",
                        lead.is_priority_target && "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30",
                        !lead.is_priority_target && lead.pushed_to_all_deals && "bg-green-50/60 hover:bg-green-50",
                        !lead.pushed_to_all_deals && "hover:bg-muted/40"
                      )}
                      onClick={() => handleRowClick(lead)}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-[40px]"
                      >
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      {/* # */}
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                        {(safePage - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      {/* Company + Website (merged, like DealTableRow) */}
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground leading-tight">
                            {extractBusinessName(lead)}
                          </p>
                          {inferWebsite(lead) && (
                            <a
                              href={`https://${inferWebsite(lead)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline truncate max-w-[180px] block"
                            >
                              {inferWebsite(lead)}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      {/* Description */}
                      <TableCell className="max-w-[220px]">
                        {lead.listing_description ? (
                          <span className="text-sm text-muted-foreground line-clamp-3 leading-tight" title={lead.listing_description}>
                            {lead.listing_description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Calculator type (only on All tab) */}
                      {activeTab === "all" && (
                        <TableCell>{calculatorBadge(lead.calculator_type)}</TableCell>
                      )}
                      {/* Industry */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
                          {lead.industry || "—"}
                        </span>
                      </TableCell>
                      {/* Location */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate block">
                          {lead.location || "—"}
                        </span>
                      </TableCell>
                      {/* Deal Owner */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {adminProfiles ? (
                          <Select
                            value={lead.deal_owner_id || "unassigned"}
                            onValueChange={(val) => handleAssignOwner(lead, val === "unassigned" ? null : val)}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs border-none bg-transparent hover:bg-muted">
                              <SelectValue placeholder="Assign…">
                                {lead.deal_owner_id && adminProfiles[lead.deal_owner_id]
                                  ? adminProfiles[lead.deal_owner_id].displayName.split(" ")[0]
                                  : <span className="text-muted-foreground">Assign…</span>
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {Object.values(adminProfiles).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Revenue */}
                      <TableCell className="text-right">
                        {lead.revenue != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.revenue)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* EBITDA */}
                      <TableCell className="text-right">
                        {lead.ebitda != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.ebitda)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Valuation */}
                      <TableCell className="text-right">
                        {lead.valuation_low != null && lead.valuation_high != null ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatCompactCurrency(lead.valuation_low)}–{formatCompactCurrency(lead.valuation_high)}
                          </span>
                        ) : lead.valuation_mid != null ? (
                          <span className="text-sm tabular-nums">{formatCompactCurrency(lead.valuation_mid)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Exit timing */}
                      <TableCell>{exitTimingBadge(lead.exit_timing)}</TableCell>
                      {/* Buyer Intro */}
                      <TableCell className="text-center">
                        {lead.open_to_intros === true ? (
                          <span className="text-emerald-600 font-semibold text-sm">Yes</span>
                        ) : lead.open_to_intros === false ? (
                          <span className="text-muted-foreground text-sm">No</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Quality */}
                      <TableCell>{qualityBadge(lead.quality_label)}</TableCell>
                      {/* Score */}
                      <TableCell className="text-center">
                        {lead.lead_score != null ? (
                          <span className={cn(
                            "text-sm font-medium px-2 py-0.5 rounded tabular-nums",
                            scorePillClass(lead.lead_score)
                          )}>
                            {lead.lead_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums text-foreground">
                          {format(new Date(lead.created_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {lead.pushed_to_all_deals ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Pushed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              New
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.is_priority_target ? (
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* View Deal */}
                            <DropdownMenuItem
                              onClick={() => {
                                if (lead.pushed_listing_id) {
                                  navigate('/admin/remarketing/deals/' + lead.pushed_listing_id, { state: { from: '/admin/remarketing/valuation-leads' } });
                                } else {
                                  handleRowClick(lead);
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Deal
                            </DropdownMenuItem>
                            {/* Enrich Deal */}
                            <DropdownMenuItem
                              onClick={() => {
                                if (lead.pushed_to_all_deals && lead.pushed_listing_id) {
                                  handleReEnrich([lead.id]);
                                } else {
                                  handlePushAndEnrich([lead.id]);
                                }
                              }}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Enrich Deal
                            </DropdownMenuItem>
                            {/* Flag: Needs Buyer Universe */}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!lead.pushed_listing_id) { sonnerToast.error("Push deal to All Deals first"); return; }
                                const newVal = !(lead as any).need_buyer_universe;
                                await supabase.from("listings").update({ need_buyer_universe: newVal } as never).eq("id", lead.pushed_listing_id);
                                sonnerToast.success(newVal ? "Flagged: Needs Buyer Universe" : "Flag removed");
                                queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Flag: Needs Buyer Universe
                            </DropdownMenuItem>
                            {/* Flag: Need to Contact Owner */}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!lead.pushed_listing_id) { sonnerToast.error("Push deal to All Deals first"); return; }
                                const newVal = !(lead as any).need_owner_contact;
                                await supabase.from("listings").update({ need_owner_contact: newVal } as never).eq("id", lead.pushed_listing_id);
                                sonnerToast.success(newVal ? "Flagged: Need to Contact Owner" : "Flag removed");
                                queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                              }}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Flag: Need to Contact Owner
                            </DropdownMenuItem>
                            {/* Mark as Priority */}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newVal = !lead.is_priority_target;
                                const { error } = await supabase
                                  .from("valuation_leads")
                                  .update({ is_priority_target: newVal } as never)
                                  .eq("id", lead.id);
                                if (error) {
                                  sonnerToast.error("Failed to update priority");
                                } else {
                                  queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                                  sonnerToast.success(newVal ? "Marked as priority" : "Priority removed");
                                }
                              }}
                              className={lead.is_priority_target ? "text-amber-600" : ""}
                            >
                              <Star className={`h-4 w-4 mr-2 ${lead.is_priority_target ? "fill-amber-500 text-amber-500" : ""}`} />
                              {lead.is_priority_target ? "Remove Priority" : "Mark as Priority"}
                            </DropdownMenuItem>
                            {/* Needs Buyer Universe */}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newVal = !lead.needs_buyer_universe;
                                const { error } = await supabase
                                  .from("valuation_leads")
                                  .update({ needs_buyer_universe: newVal } as never)
                                  .eq("id", lead.id);
                                if (error) {
                                  sonnerToast.error("Failed to update flag");
                                } else {
                                  queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                                  sonnerToast.success(newVal ? "Flagged: Needs Buyer Universe" : "Flag removed");
                                }
                              }}
                              className={lead.needs_buyer_universe ? "text-blue-600" : ""}
                            >
                              <Users2 className={cn("h-4 w-4 mr-2", lead.needs_buyer_universe && "text-blue-600")} />
                              {lead.needs_buyer_universe ? "Remove Buyer Universe Flag" : "Needs Buyer Universe"}
                            </DropdownMenuItem>
                            {/* Need to Contact Owner */}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newVal = !lead.need_to_contact_owner;
                                const { error } = await supabase
                                  .from("valuation_leads")
                                  .update({ need_to_contact_owner: newVal } as never)
                                  .eq("id", lead.id);
                                if (error) {
                                  sonnerToast.error("Failed to update flag");
                                } else {
                                  queryClient.invalidateQueries({ queryKey: ["remarketing", "valuation-leads"] });
                                  sonnerToast.success(newVal ? "Flagged: Need to Contact Owner" : "Flag removed");
                                }
                              }}
                              className={lead.need_to_contact_owner ? "text-orange-600" : ""}
                            >
                              <Phone className={cn("h-4 w-4 mr-2", lead.need_to_contact_owner && "text-orange-600")} />
                              {lead.need_to_contact_owner ? "Remove Contact Owner Flag" : "Need to Contact Owner"}
                            </DropdownMenuItem>
                            {/* Approve to All Deals */}
                            <DropdownMenuItem
                              onClick={() => handlePushToAllDeals([lead.id])}
                              disabled={!!lead.pushed_to_all_deals}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve to All Deals
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* Archive Deal */}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                const { error } = await supabase
                                  .from("valuation_leads")
                                  .update({ is_archived: true })
                                  .eq("id", lead.id);
                                if (error) {
                                  sonnerToast.error("Failed to archive lead");
                                } else {
                                  sonnerToast.success("Lead archived");
                                  refetch();
                                }
                              }}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive Deal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filteredLeads.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} leads
          {filteredLeads.length !== totalLeads && ` (filtered from ${totalLeads})`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={safePage <= 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-3 tabular-nums flex items-center gap-1">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={safePage >= totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
