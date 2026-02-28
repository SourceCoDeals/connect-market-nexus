# Edge Functions Reference

## Overview

160 Deno-based edge functions deployed to Supabase. All functions share common patterns via 24+ modules in `_shared/`.

> **Last updated:** 2026-02-28 (CTO Deep-Dive Audit)

## Shared Modules (`supabase/functions/_shared/`)

| Module | Purpose |
|--------|---------|
| **auth.ts** | `requireAuth()`, `requireAdmin()`, `escapeHtml()` |
| **cors.ts** | CORS allowlist, `getCorsHeaders()`, preflight handling |
| **security.ts** | Rate limiting, SSRF protection (`validateUrl()`), input sanitization |
| **validation.ts** | Anti-hallucination guards: placeholder detection, revenue/EBITDA range validation |
| **ai-providers.ts** | Gemini 2.0 Flash integration, retry logic, token tracking |
| **brevo-sender.ts** | Email delivery via Brevo API |
| **rate-limiter.ts** | Provider-level concurrency coordination |
| **provenance.ts** | Data ownership rules (source priorities) |
| **buyer-extraction.ts** | AI extraction prompts for buyer enrichment |
| **deal-extraction.ts** | AI extraction prompts for deal data |
| **cost-tracker.ts** | AI operation cost logging |
| **enrichment-events.ts** | Enrichment status logging |
| **geography.ts** | State normalization, geographic utilities |
| **geography-utils.ts** | Proximity scoring, state-to-tier mappings |
| **edge-timeout.ts** | Deno timeout signal helpers |
| **error-response.ts** | Standardized error responses with CORS |
| **claude-client.ts** | Claude/Anthropic API wrapper |
| **serper-client.ts** | Google Search/Maps via Serper |
| **prospeo-client.ts** | Email enrichment via Prospeo |
| **apify-client.ts** | LinkedIn/web scraping via Apify |
| **smartlead-client.ts** | Smartlead email campaign client |
| **heyreach-client.ts** | HeyReach LinkedIn outreach client |
| **contact-intelligence.ts** | Contact analysis utilities |
| **criteria-validation.ts** | Buyer criteria validation |
| **source-priority.ts** | Data source prioritization |
| **global-activity-queue.ts** | Activity queue management |
| **email-logger.ts** | Email delivery logging |
| **chat-tools.ts** | AI chat tool definitions |
| **chat-persistence.ts** | Chat conversation storage |
| **admin-profiles.ts** | Admin profile utilities |

## Key Functions

### Data Room
| Function | Auth | Purpose |
|----------|------|---------|
| `data-room-access` | Admin | Manage buyer access grants/revocations |
| `data-room-upload` | Admin | Upload documents to deal data rooms |
| `data-room-download` | Auth | Generate signed URLs for document access |

### AI / Memos
| Function | Auth | Purpose |
|----------|------|---------|
| `generate-lead-memo` | Admin | AI-generate anonymous teaser or full memo |
| `draft-outreach-email` | Admin | AI-draft buyer outreach emails |
| `send-memo-email` | Admin | Send memo via email + log distribution |

### Enrichment
| Function | Auth | Purpose |
|----------|------|---------|
| `enrich-buyer` | Admin/Service | Multi-source buyer enrichment (website scraping + AI) |
| `enrich-deal` | Admin | Deal data enrichment |
| `find-buyer-contacts` | Admin | Contact discovery for buyers |

### Scoring
| Function | Auth | Purpose |
|----------|------|---------|
| `score-buyer-deal` | Admin/None | Multi-dimensional buyer-deal fit scoring |
| `parse-fit-criteria` | Admin | AI-parse investment criteria text |

### Email
| Function | Auth | Purpose |
|----------|------|---------|
| `send-approval-email` | Admin | User approval notification |
| `send-connection-notification` | Admin | Connection request notification |
| `send-deal-alert` | Service | New deal alert to matching buyers |
| `send-fee-agreement-email` | Admin | Fee agreement request |
| `send-nda-email` | Admin | NDA request |

### Chat / Query
| Function | Auth | Purpose |
|----------|------|---------|
| `chat-buyer-query` | Auth | Interactive buyer universe chat |
| `query-buyer-universe` | Admin | Buyer universe matching |

## Common Patterns

### Auth Guard
```ts
const auth = await requireAdmin(req, supabaseAdmin);
if (!auth.isAdmin) {
  return new Response(JSON.stringify({ error: auth.error }), {
    status: auth.authenticated ? 403 : 401,
    headers: corsHeaders,
  });
}
```

### CORS
```ts
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: getCorsHeaders(req) });
}
```

### Error Response
```ts
return new Response(
  JSON.stringify({ error: 'message', code: 'ERROR_CODE' }),
  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

### Integrations
| Function | Auth | Purpose |
|----------|------|---------|
| `apify-linkedin-scrape` | Admin | LinkedIn employee scraping via Apify |
| `apify-google-reviews` | Admin | Google reviews collection via Apify |
| `firecrawl-scrape` | Admin | Website content extraction via Firecrawl |
| `discover-companies` | Admin | Company discovery via Serper |
| `fetch-fireflies-content` | Admin | Fireflies.ai transcript retrieval |
| `auto-pair-all-fireflies` | Admin | Auto-pair Fireflies transcripts to deals |
| `bulk-sync-all-fireflies` | Admin/Cron | Bulk sync all Fireflies transcripts |
| `sync-standup-meetings` | Cron | Poll Fireflies for standup meeting transcripts |
| `docuseal-webhook-handler` | None (webhook) | DocuSeal e-signature webhook receiver |
| `create-docuseal-submission` | Admin | Create DocuSeal signing request |
| `smartlead-webhook-handler` | None (webhook) | Smartlead campaign webhook receiver |
| `phoneburner-webhook` | None (webhook) | PhoneBurner call activity webhook |
| `heyreach-webhook` | None (webhook) | HeyReach LinkedIn outreach webhook |
| `salesforce-remarketing-webhook` | None (webhook) | Salesforce deal sync webhook |

### Admin / User Management
| Function | Auth | Purpose |
|----------|------|---------|
| `approve-marketplace-buyer` | Admin | Approve buyer marketplace access |
| `auto-create-firm-on-approval` | Service | Auto-create firm record on approval |
| `admin-notification` | Admin | Send admin notifications |
| `admin-digest` | Cron | Daily admin digest email |
| `admin-reset-password` | Admin | Admin-initiated password reset |
| `session-heartbeat` | Auth | Session keepalive heartbeat |
| `error-logger` | Service | Persistent error logging |

### AI / Intelligence
| Function | Auth | Purpose |
|----------|------|---------|
| `ai-command-center` | Auth | AI assistant backend (Claude) |
| `analyze-buyer-notes` | Admin | AI analysis of buyer notes |
| `analyze-deal-notes` | Admin | AI analysis of deal notes |
| `analyze-tracker-notes` | Admin | AI analysis of tracker notes |
| `analyze-seller-interest` | Admin | AI seller interest analysis |
| `clarify-industry` | Admin | AI industry classification |
| `generate-ma-guide` | Admin | AI-generate M&A guide content |
| `extract-deal-transcript` | Admin | Extract deal data from transcripts |
| `extract-transcript` | Admin | General transcript extraction |
| `extract-standup-tasks` | Admin | Extract tasks from standup transcripts |

### Bulk Operations
| Function | Auth | Purpose |
|----------|------|---------|
| `bulk-import-remarketing` | Admin | Bulk import buyers/deals from CSV |
| `map-csv-columns` | Admin | AI-assisted CSV column mapping |
| `sync-captarget-sheet` | Admin | Sync deals from CapTarget Google Sheet |
| `process-enrichment-queue` | Service | Process async enrichment queue |
| `dedupe-buyers` | Admin | Deduplicate buyer records |

### Scoring
| Function | Auth | Purpose |
|----------|------|---------|
| `calculate-buyer-quality-score` | None | Compute buyer quality score |
| `calculate-deal-quality` | Admin | Compute deal quality score |
| `calculate-valuation-lead-score` | Admin | Score valuation leads |
| `recalculate-deal-weights` | Admin | Recalculate deal priority weights |
| `analyze-scoring-patterns` | Admin | Analyze scoring patterns |

## JWT Configuration

Per-function JWT verification is configured in `supabase/config.toml`. Functions that accept internal service-to-service calls (e.g., `score-buyer-deal`) or webhooks have `verify_jwt = false`.

**Security note (from Feb 28 audit):** Approximately 20% of edge functions use the shared CORS module from `_shared/cors.ts`. Remaining functions should be migrated to use the shared module to ensure consistent origin restriction. See `CTO_DEEP_DIVE_AUDIT_2026-02-28.md` for details.

## Function Size Guide

Functions exceeding 700 lines are candidates for refactoring into sub-modules:

| Function | Lines | Recommendation |
|----------|-------|----------------|
| `generate-ma-guide` | 1,500 | Extract prompt templates |
| `apify-linkedin-scrape` | 1,027 | Split parsing/API logic |
| `extract-deal-transcript` | 920 | Consolidate with `extract-transcript` |
| `enrich-deal` | 857 | Extract enrichment phases |
| `bulk-sync-all-fireflies` | 839 | Extract sync logic |
| `score-buyer-deal` | 733 | Good progress (was 2,158) |
