import { useMemo } from "react";
import type { ValuationLead, SortColumn, SortDirection, AdminProfileMap } from "./types";
import {
  cleanWebsiteToDomain,
  extractBusinessName,
  inferWebsite,
  QUALITY_ORDER,
} from "./helpers";

interface UseFilteredLeadsOptions {
  engineFiltered: ValuationLead[];
  activeTab: string;
  hidePushed: boolean;
  isInRange: (dateStr: string) => boolean;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  adminProfiles: AdminProfileMap | undefined;
}

export function useFilteredLeads({
  engineFiltered,
  activeTab,
  hidePushed,
  isInRange,
  sortColumn,
  sortDirection,
  adminProfiles,
}: UseFilteredLeadsOptions): ValuationLead[] {
  return useMemo(() => {
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

    // Deduplicate by normalized domain -- keep the best record per website
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
        if (newScore > existingScore || (newScore === existingScore && newDate > existingDate)) {
          domainMap.set(key, lead);
        }
      }
    }
    filtered = Array.from(domainMap.values());

    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let valA: string | number, valB: string | number;
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
}
