# Edge Functions Reference

## Overview

113 Deno-based edge functions deployed to Supabase. All functions share common patterns via 24 modules in `_shared/`.

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

## JWT Configuration

Per-function JWT verification is configured in `supabase/config.toml`. Functions that accept internal service-to-service calls (e.g., `score-buyer-deal`) have `verify_jwt = false`.
