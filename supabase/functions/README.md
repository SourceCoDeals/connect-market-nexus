# Supabase Edge Functions — SourceCo Platform

> Last updated: 2026-02-26 (CTO Audit)

## Overview

The SourceCo platform uses **143 Supabase Edge Functions** organized by domain. All functions run on Deno and are deployed via Supabase CLI.

## Function Index by Domain

### AI & Language Processing (10 functions)
| Function | Purpose |
|----------|---------|
| `ai-command-center` | Main AI chat interface with 85 tools, SSE streaming |
| `analyze-buyer-notes` | Extract buyer intelligence from unstructured notes |
| `analyze-deal-notes` | Extract deal intelligence and financials from notes |
| `analyze-seller-interest` | Score seller motivation/readiness (0-100) |
| `analyze-tracker-notes` | Extract buyer universe criteria from call notes |
| `generate-buyer-intro` | Generate personalized buyer intro emails |
| `generate-lead-memo` | Generate M&A memos for leads |
| `generate-ma-guide` | Generate M&A guides for deals (async) |
| `generate-ma-guide-background` | Background M&A guide generation |
| `generate-research-questions` | Generate due diligence research questions |

### Data Enrichment & Extraction (15 functions)
| Function | Purpose |
|----------|---------|
| `apify-google-reviews` | Scrape Google Maps reviews via Apify |
| `apify-linkedin-scrape` | Scrape LinkedIn company data via Apify |
| `enrich-buyer` | Enrich buyer records with external data |
| `enrich-deal` | Enrich deals with company data and financials |
| `enrich-external-only` | Lightweight LinkedIn + Google enrichment |
| `enrich-geo-data` | Enrich geographic/location data |
| `enrich-list-contacts` | Bulk enrich contact lists via Prospeo |
| `enrich-session-metadata` | Enrich session data with device/location info |
| `extract-buyer-criteria` | Extract investment criteria from buyer data |
| `extract-buyer-transcript` | Extract buyer intelligence from transcripts |
| `extract-deal-document` | Extract structured data from deal documents |
| `extract-deal-transcript` | Extract deal data from call transcripts |
| `extract-transcript` | Generic transcript text extraction |
| `parse-transcript-file` | Parse uploaded transcript files |
| `test-contact-enrichment` | Test contact enrichment functionality |

### Buyer Scoring & Matching (8 functions)
| Function | Purpose |
|----------|---------|
| `analyze-scoring-patterns` | Analyze buyer approval patterns |
| `calculate-buyer-quality-score` | Score buyer quality (1-4 tiers) |
| `query-buyer-universe` | Find matching buyers for deals |
| `score-buyer-deal` | Calculate buyer-deal fit score (A-F tier) |
| `score-industry-alignment` | Score buyer industry alignment |
| `extract-buyer-criteria-background` | Background buyer criteria extraction |
| `find-buyer-contacts` | Find buyer contacts matching criteria |
| `validate-criteria` | Validate buyer/deal matching criteria |

### Notifications & Emails (20 functions)
| Function | Purpose |
|----------|---------|
| `approve-marketplace-buyer` | Approve marketplace buyer & send tracked link |
| `approve-referral-submission` | Approve referral deals |
| `enhanced-admin-notification` | Dual-provider email (Resend → Brevo failover) |
| `enhanced-email-delivery` | Dual-provider email with retry logic |
| `invite-team-member` | Send team member invitations |
| `send-*` | Various notification emails (14 functions) |

### Integrations (12 functions)
| Function | Purpose |
|----------|---------|
| `auto-pair-all-fireflies` | Match Fireflies transcripts to buyers/deals |
| `bulk-sync-all-fireflies` | Bulk sync all Fireflies transcripts |
| `fetch-fireflies-content` | Fetch full transcript content |
| `sync-fireflies-transcripts` | Sync Fireflies transcript metadata |
| `heyreach-campaigns` | Sync HeyReach campaign data |
| `heyreach-leads` | Sync HeyReach leads |
| `heyreach-webhook` | Handle HeyReach webhooks |
| `phoneburner-oauth-callback` | Handle PhoneBurner OAuth |
| `phoneburner-push-contacts` | Push contacts to PhoneBurner |
| `phoneburner-webhook` | Handle PhoneBurner webhooks |
| `smartlead-campaigns` | Sync Smartlead campaigns |
| `smartlead-leads` | Sync Smartlead leads |
| `smartlead-webhook` | Handle Smartlead webhooks |

### Documents & Data Rooms (8 functions)
| Function | Purpose |
|----------|---------|
| `create-docuseal-submission` | Create e-signature requests |
| `data-room-access` | Grant/manage data room access |
| `data-room-download` | Secure file downloads |
| `data-room-upload` | Secure file uploads |
| `docuseal-webhook-handler` | Handle DocuSeal signature status webhooks |
| `get-agreement-document` | Retrieve agreement documents |
| `get-buyer-fee-embed` | Fee agreement embed URL |
| `get-buyer-nda-embed` | NDA agreement embed URL |

### Deals & Listings (10 functions)
| Function | Purpose |
|----------|---------|
| `cleanup-captarget-deals` | Clean up CapTarget deals |
| `convert-to-pipeline-deal` | Convert marketplace → pipeline |
| `publish-listing` | Publish deals to marketplace |
| `calculate-deal-quality` | Calculate deal quality scores |
| `calculate-valuation-lead-score` | Score valuation potential |
| `sync-captarget-sheet` | Sync from CapTarget Google Sheets |
| `suggest-universe` | Suggest buyer universes for deals |
| `recalculate-deal-weights` | Recalculate scoring weights |
| `submit-referral-deal` | Submit referral deals |
| `reset-agreement-data` | Reset NDA/agreement status |

### Queue & Background Processing (8 functions)
| Function | Purpose |
|----------|---------|
| `process-enrichment-queue` | Process deal enrichment queue |
| `process-buyer-enrichment-queue` | Process buyer enrichment queue |
| `process-ma-guide-queue` | Process M&A guide generation queue |
| `process-scoring-queue` | Process buyer-deal scoring queue |
| `extract-standup-tasks` | Extract tasks from standup notes |
| `process-standup-webhook` | Handle standup webhooks |
| `search-fireflies-for-buyer` | Search Fireflies for buyer calls |
| `sync-fireflies-transcripts` | Sync Fireflies metadata |

### Auth & Security (6 functions)
| Function | Purpose |
|----------|---------|
| `admin-reset-password` | Admin-only password reset |
| `otp-rate-limiter` | Rate-limit OTP requests |
| `password-reset` | User password reset flow |
| `password-security` | Password strength validation |
| `security-validation` | Token verification |
| `session-security` | Session integrity checks |

### Admin & Analytics (6 functions)
| Function | Purpose |
|----------|---------|
| `admin-digest` | Generate admin dashboards |
| `aggregate-daily-metrics` | Calculate daily platform metrics |
| `get-feedback-analytics` | Aggregated feedback analytics |
| `session-heartbeat` | Track session activity |
| `track-engagement-signal` | Record engagement signals |
| `record-link-open` | Track document link opens |

## Shared Modules (`_shared/`)

Common utilities shared across functions:
- `cors.ts` — CORS header management
- `supabase-client.ts` — Supabase client factory
- `apify-client.ts` — Apify API client
- `prospeo-client.ts` — Prospeo API client
- `smartlead-client.ts` — Smartlead API client
- `heyreach-client.ts` — HeyReach API client
- `captarget-exclusion-filter.ts` — CapTarget company exclusion logic
- `security.ts` — Auth and security utilities
- `error-response.ts` — Standardized error responses
- `ai-providers.ts` — AI model provider abstraction
- `geography.ts` — Geographic data utilities
- `provenance.ts` — Data source tracking
- `source-priority.ts` — Data source priority resolution

## External API Dependencies

| Service | Purpose | Key Env Var |
|---------|---------|-------------|
| Anthropic Claude | AI Command Center, content generation | `ANTHROPIC_API_KEY` |
| Apify | LinkedIn scraping, Google search | `APIFY_API_KEY` |
| Prospeo | Email/phone enrichment | `PROSPEO_API_KEY` |
| DocuSeal | NDA/fee agreement e-signatures | `DOCUSEAL_API_KEY` |
| Fireflies | Call transcript retrieval | `FIREFLIES_API_KEY` |
| Smartlead | Cold email campaigns | `SMARTLEAD_API_KEY` |
| PhoneBurner | Dialer integration | `PHONEBURNER_CLIENT_ID` |
| HeyReach | LinkedIn outreach | `HEYREACH_API_KEY` |
| Brevo | Transactional email | `BREVO_API_KEY` |
| Resend | Email failover provider | `RESEND_API_KEY` |
| Firecrawl | Web scraping | `FIRECRAWL_API_KEY` |
| Google Sheets | CapTarget deal sourcing | `GOOGLE_SERVICE_ACCOUNT_KEY` |
