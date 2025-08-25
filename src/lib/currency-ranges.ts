// Standardized currency range options for consistent data entry

export const REVENUE_RANGES = [
  { value: "Under $1M", label: "Under $1M" },
  { value: "$1M - $5M", label: "$1M - $5M" },
  { value: "$5M - $10M", label: "$5M - $10M" },
  { value: "$10M - $25M", label: "$10M - $25M" },
  { value: "$25M - $50M", label: "$25M - $50M" },
  { value: "$50M - $100M", label: "$50M - $100M" },
  { value: "Over $100M", label: "Over $100M" },
] as const;

export const FUND_AUM_RANGES = [
  { value: "Under $10M", label: "Under $10M" },
  { value: "$10M - $50M", label: "$10M - $50M" },
  { value: "$50M - $100M", label: "$50M - $100M" },
  { value: "$100M - $500M", label: "$100M - $500M" },
  { value: "$500M - $1B", label: "$500M - $1B" },
  { value: "Over $1B", label: "Over $1B" },
] as const;

export const INVESTMENT_RANGES = [
  { value: "Under $1M", label: "Under $1M" },
  { value: "$1M - $5M", label: "$1M - $5M" },
  { value: "$5M - $10M", label: "$5M - $10M" },
  { value: "$10M - $25M", label: "$10M - $25M" },
  { value: "$25M - $50M", label: "$25M - $50M" },
  { value: "Over $50M", label: "Over $50M" },
] as const;

export const DEAL_SIZE_RANGES = [
  { value: "Under $1M", label: "Under $1M" },
  { value: "$1M - $5M", label: "$1M - $5M" },
  { value: "$5M - $10M", label: "$5M - $10M" },
  { value: "$10M - $25M", label: "$10M - $25M" },
  { value: "$25M - $50M", label: "$25M - $50M" },
  { value: "Over $50M", label: "Over $50M" },
] as const;