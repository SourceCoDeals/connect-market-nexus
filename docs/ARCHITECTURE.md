# Connect Market Nexus — Architecture Overview

## System Overview

Connect Market Nexus is a B2B M&A deal marketplace platform. It connects deal sellers with qualified buyers through a marketplace, AI-powered buyer-deal matching, and a full remarketing pipeline.

**Live**: https://marketplace.sourcecodeals.com

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix) |
| State | React Query (TanStack Query), React Context |
| Backend | Supabase (PostgreSQL 15, Auth, Storage, Edge Functions) |
| Edge Functions | Deno (TypeScript), 113 functions + 24 shared modules |
| AI | Gemini 2.0 Flash (via `ai-providers.ts` shared module) |
| Email | Brevo (Sendinblue) transactional email |
| Maps | Mapbox GL |
| Rich Text | TipTap editor |

## Codebase Metrics

| Metric | Count |
|--------|-------|
| React Components | 710 |
| Custom Hooks | 207 |
| Pages | 75 |
| Edge Functions | 113 |
| Shared Modules | 24 |
| SQL Migrations | 130+ |
| Database Tables | 22+ (all with RLS) |

## Directory Structure

```
src/
├── pages/                  # Route-level components
│   ├── admin/             # Admin dashboard, listings, users, pipeline
│   │   ├── remarketing/   # ReMarketing module (universes, buyers, deals)
│   │   ├── ma-intelligence/ # M&A Intelligence (trackers, all-buyers)
│   │   ├── analytics/     # Analytics pages
│   │   └── settings/      # Admin settings
│   ├── Marketplace.tsx    # Buyer marketplace
│   ├── ListingDetail.tsx  # Deal detail page
│   ├── Profile.tsx        # Buyer profile
│   └── Login.tsx / Signup.tsx
├── components/
│   ├── admin/             # Admin-specific (data-room, sidebar, MFA)
│   ├── listing/           # Deal cards, grids
│   ├── listing-detail/    # Deal detail sections
│   ├── marketplace/       # Buyer marketplace (BuyerDataRoom)
│   ├── auth/              # MFA challenge
│   └── ui/                # shadcn base components
├── hooks/
│   ├── admin/             # Admin hooks (data-room, listings, users)
│   ├── marketplace/       # Marketplace hooks
│   └── auth/              # Auth hooks
├── lib/                   # Pure utilities (scoring, parsing, security)
├── types/                 # TypeScript type definitions
├── integrations/supabase/ # Supabase client + auto-generated types
└── context/               # React Context providers (Auth, Analytics)

supabase/
├── functions/             # 113 edge functions
│   ├── _shared/           # 24 shared modules
│   ├── data-room-*/       # Data room operations
│   ├── generate-lead-memo/# AI memo generation
│   ├── score-buyer-deal/  # Buyer-deal scoring engine
│   ├── enrich-buyer/      # AI buyer enrichment
│   └── ...
├── migrations/            # 130+ SQL migrations
└── config.toml            # Function JWT configs
```

## Core Modules

### 1. Marketplace
Buyer-facing deal browsing with advanced filtering (category, location, size), connection requests, and deal bookmarking.

### 2. Admin Dashboard
Deal CRUD, user approval workflow, connection request management, email notifications, referral partner tracking.

### 3. ReMarketing System
Outbound deal sourcing: buyer universes, external buyer database, AI-powered scoring/matching, contact discovery, introduction automation.

### 4. M&A Intelligence
Deal trackers, buyer research profiles, transcription analysis.

### 5. Data Room (Feb 2026)
Per-deal document storage with 3-toggle access control (teaser/full memo/data room), complete audit trail, signed URL downloads.

### 6. Lead Memos (Feb 2026)
AI-generated deal summaries (anonymous teaser + full memo), rich text editing, version history, email distribution tracking.

### 7. MFA Security (Feb 2026)
TOTP-based multi-factor authentication enrollment and challenge flow for admin users.

## Authentication & Authorization

- **Auth**: Supabase Auth with JWT, MFA via TOTP
- **Roles**: Admin (via `is_admin()` RPC) and Buyer (approved via `approval_status`)
- **RLS**: All 22+ tables have Row Level Security policies
- **Edge Functions**: Auth via `requireAuth()` / `requireAdmin()` shared helpers

## Data Flow

```
Browser → Supabase Client → PostgreSQL (RLS enforced)
                          → Edge Functions → External APIs (Gemini, Firecrawl, Brevo)
                          → Supabase Storage (deal documents)
```

## Testing

- **Framework**: Vitest 4.x
- **Run**: `npm test` (single run) or `npm run test:watch` (watch mode)
- **Coverage areas**: Scoring engine, currency parsing, financial extraction, SSRF protection, input validation, anti-hallucination guards
- **Test files**: `src/lib/*.test.ts`, `supabase/functions/_shared/*.test.ts`
