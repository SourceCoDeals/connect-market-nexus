/**
 * Centralized query key factory for M&A Intelligence TanStack Query.
 *
 * Benefits:
 * - Prevents key collisions between different queries
 * - Ensures consistent invalidation patterns
 * - Provides type safety for query keys
 * - Makes refactoring easier
 *
 * Usage:
 * ```typescript
 * // In a query hook:
 * useQuery({
 *   queryKey: trackerKeys.detail(trackerId),
 *   queryFn: () => fetchTracker(trackerId),
 * });
 *
 * // For invalidation:
 * queryClient.invalidateQueries({ queryKey: trackerKeys.all });
 * ```
 */

export const maTrackerKeys = {
  all: ["ma-trackers"] as const,
  lists: () => [...maTrackerKeys.all, "list"] as const,
  list: (filters?: { archived?: boolean }) =>
    [...maTrackerKeys.lists(), filters] as const,
  details: () => [...maTrackerKeys.all, "detail"] as const,
  detail: (id: string) => [...maTrackerKeys.details(), id] as const,
};

export const maBuyerKeys = {
  all: ["ma-buyers"] as const,
  lists: () => [...maBuyerKeys.all, "list"] as const,
  byTracker: (trackerId: string) =>
    [...maBuyerKeys.lists(), "tracker", trackerId] as const,
  details: () => [...maBuyerKeys.all, "detail"] as const,
  detail: (id: string) => [...maBuyerKeys.details(), id] as const,
  contacts: (buyerId: string) =>
    [...maBuyerKeys.detail(buyerId), "contacts"] as const,
  transcripts: (buyerId: string) =>
    [...maBuyerKeys.detail(buyerId), "transcripts"] as const,
};

export const maDealKeys = {
  all: ["ma-deals"] as const,
  lists: () => [...maDealKeys.all, "list"] as const,
  byTracker: (trackerId: string) =>
    [...maDealKeys.lists(), "tracker", trackerId] as const,
  details: () => [...maDealKeys.all, "detail"] as const,
  detail: (id: string) => [...maDealKeys.details(), id] as const,
  transcripts: (dealId: string) =>
    [...maDealKeys.detail(dealId), "transcripts"] as const,
  scores: (dealId: string) =>
    [...maDealKeys.detail(dealId), "scores"] as const,
};

export const buyerDealScoreKeys = {
  all: ["buyerDealScores"] as const,
  byDeal: (dealId: string) =>
    [...buyerDealScoreKeys.all, "deal", dealId] as const,
  byBuyer: (buyerId: string) =>
    [...buyerDealScoreKeys.all, "buyer", buyerId] as const,
  specific: (buyerId: string, dealId: string) =>
    [...buyerDealScoreKeys.all, buyerId, dealId] as const,
};

export const peFirmKeys = {
  all: ["peFirms"] as const,
  lists: () => [...peFirmKeys.all, "list"] as const,
  details: () => [...peFirmKeys.all, "detail"] as const,
  detail: (id: string) => [...peFirmKeys.details(), id] as const,
  contacts: (firmId: string) =>
    [...peFirmKeys.detail(firmId), "contacts"] as const,
  platforms: (firmId: string) =>
    [...peFirmKeys.detail(firmId), "platforms"] as const,
};

export const platformKeys = {
  all: ["platforms"] as const,
  lists: () => [...platformKeys.all, "list"] as const,
  byPeFirm: (peFirmId: string) =>
    [...platformKeys.lists(), "peFirm", peFirmId] as const,
  details: () => [...platformKeys.all, "detail"] as const,
  detail: (id: string) => [...platformKeys.details(), id] as const,
  contacts: (platformId: string) =>
    [...platformKeys.detail(platformId), "contacts"] as const,
};

export const outreachKeys = {
  all: ["outreach"] as const,
  byDeal: (dealId: string) =>
    [...outreachKeys.all, "deal", dealId] as const,
  byBuyer: (buyerId: string) =>
    [...outreachKeys.all, "buyer", buyerId] as const,
};

export const maCompanyKeys = {
  all: ["ma-companies"] as const,
  lists: () => [...maCompanyKeys.all, "list"] as const,
  details: () => [...maCompanyKeys.all, "detail"] as const,
  detail: (id: string) => [...maCompanyKeys.details(), id] as const,
  byDomain: (domain: string) =>
    [...maCompanyKeys.all, "domain", domain] as const,
};
