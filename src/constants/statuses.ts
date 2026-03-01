export const DEAL_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
} as const;

export const CONNECTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export const ENRICHMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const BUYER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PASSED: 'passed',
  NOT_A_FIT: 'not_a_fit',
} as const;

export type DealStatus = typeof DEAL_STATUS[keyof typeof DEAL_STATUS];
export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];
export type EnrichmentStatus = typeof ENRICHMENT_STATUS[keyof typeof ENRICHMENT_STATUS];
export type BuyerStatus = typeof BUYER_STATUS[keyof typeof BUYER_STATUS];
