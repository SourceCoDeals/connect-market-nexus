# Connect Market Nexus - System Architecture

## Overview

Connect Market Nexus (SourceCo) is an M&A remarketing platform that connects business sellers with qualified buyers through AI-powered matching, scoring, and outreach tools. The platform enables deal advisors to manage buyer universes, generate industry M&A guides, score buyer-deal fit, and facilitate introductions.

## Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | SPA with Vite build system |
| **UI Framework** | shadcn/ui + Tailwind CSS | Radix primitives, responsive design |
| **State Management** | TanStack React Query v5 | Server state caching and synchronization |
| **Routing** | React Router v6 | Client-side routing with protected routes |
| **Backend** | Supabase Edge Functions | Deno runtime, 89 serverless functions |
| **Database** | PostgreSQL (Supabase) | 99 tables, Row Level Security (RLS) |
| **Authentication** | Supabase Auth | JWT-based, role-based access control |
| **AI Providers** | Gemini, Claude, OpenAI | Multi-provider with unified client |
| **Email** | Resend | Transactional email delivery |
| **Scraping** | Apify, Firecrawl | Web data extraction |
| **Maps** | Mapbox GL | Geographic visualization |
| **Rich Text** | TipTap v3 | WYSIWYG editor for guides/notes |
| **Drag & Drop** | @dnd-kit | Sortable lists for deal ranking |
| **Deployment** | Lovable | Automated deployment pipeline |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (SPA)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Marketplace│ │  Admin   │ │Remarketing│ │MA Intelligence│  │
│  │  Pages   │ │Dashboard │ │  Module   │ │   Module     │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       │             │            │               │           │
│  ┌────┴─────────────┴────────────┴───────────────┴────┐     │
│  │          Supabase JS Client + React Query           │     │
│  └────────────────────────┬───────────────────────────┘     │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────┼─────────────────────────────────┐
│                    Supabase Platform                         │
│  ┌────────────────────────┴───────────────────────────┐     │
│  │              Edge Functions (89 functions)           │     │
│  │  ┌─────────┐ ┌────────┐ ┌───────┐ ┌────────────┐  │     │
│  │  │   AI    │ │ Email  │ │Scoring│ │  Security  │  │     │
│  │  │Functions│ │Delivery│ │Engine │ │  & Auth    │  │     │
│  │  └────┬────┘ └───┬────┘ └───┬───┘ └─────┬──────┘  │     │
│  │       │          │          │            │          │     │
│  │  ┌────┴──────────┴──────────┴────────────┴────┐    │     │
│  │  │           Shared Modules (_shared/)         │    │     │
│  │  │  ai-client │ security │ validation │ geo   │    │     │
│  │  └────────────────────────────────────────────┘    │     │
│  └────────────────────────┬───────────────────────────┘     │
│  ┌────────────────────────┴───────────────────────────┐     │
│  │              PostgreSQL Database                     │     │
│  │  99 tables │ RLS policies │ DB functions │ Views    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
   ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
   │  Gemini AI  │  │  Claude AI  │  │   Resend    │
   │  (primary)  │  │ (secondary) │  │   (email)   │
   └─────────────┘  └─────────────┘  └─────────────┘
```

## Frontend Architecture

### Directory Structure

```
src/
├── pages/                    # Route-level components
│   ├── Index.tsx             # Landing page
│   ├── Login.tsx             # Auth pages
│   ├── Marketplace.tsx       # Public deal listings
│   ├── Dashboard.tsx         # User dashboard
│   ├── admin/                # Admin-only pages
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminListings.tsx
│   │   ├── AdminPipeline.tsx
│   │   ├── AdminRequests.tsx
│   │   ├── AdminUsers.tsx
│   │   ├── AdminDealSourcing.tsx
│   │   ├── AdminNotifications.tsx
│   │   ├── FirmAgreements.tsx
│   │   ├── remarketing/      # ReMarketing module pages
│   │   │   ├── ReMarketingDashboard.tsx
│   │   │   ├── ReMarketingBuyers.tsx
│   │   │   ├── ReMarketingDeals.tsx
│   │   │   ├── ReMarketingUniverses.tsx
│   │   │   ├── ReMarketingDealMatching.tsx
│   │   │   └── ReMarketingIntroductions.tsx
│   │   └── ma-intelligence/  # M&A Intelligence module
│   │       ├── Dashboard.tsx
│   │       ├── Trackers.tsx
│   │       ├── AllBuyers.tsx
│   │       └── AllDeals.tsx
├── components/               # Reusable UI components
│   ├── ui/                   # shadcn/ui primitives
│   ├── remarketing/          # ReMarketing-specific components
│   ├── ma-intelligence/      # M&A Intelligence components
│   ├── admin/                # Admin panel components
│   ├── auth/                 # Authentication components
│   └── shared/               # Cross-module shared components
├── hooks/                    # Custom React hooks (80+ hooks)
│   ├── remarketing/          # ReMarketing data hooks
│   ├── ma-intelligence/      # M&A Intelligence hooks
│   ├── admin/                # Admin hooks
│   └── use-*.ts              # General-purpose hooks
├── context/                  # React Context providers
│   ├── AuthContext.tsx        # Authentication state
│   ├── AnalyticsContext.tsx   # Analytics tracking
│   ├── NavigationStateContext.tsx
│   └── TabVisibilityContext.tsx
├── integrations/
│   └── supabase/
│       ├── client.ts         # Supabase client initialization
│       └── types.ts          # Auto-generated database types
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions
└── lib/                      # Library configurations
```

### Key Frontend Modules

#### 1. Marketplace (Public)
User-facing deal marketplace where sellers list businesses and buyers browse opportunities.
- Deal listings with search and filtering
- Saved listings and collections
- Connection requests between buyers and sellers

#### 2. Admin Dashboard
Admin-only management interface for deal pipeline, users, and platform operations.
- Deal pipeline management with stages
- User management and role assignment
- Notification center
- Deal sourcing and firm agreements

#### 3. ReMarketing Module
AI-powered buyer remarketing system for matching buyers to deals.
- **Buyer Universe Management**: Group buyers into industry-specific universes
- **M&A Guide Generation**: AI-generated 13-phase industry guides (streaming SSE)
- **Buyer Criteria Extraction**: Extract size/service/geography criteria from guides
- **Deal Scoring**: Score buyer-deal fit using AI analysis
- **Deal Ranking**: Manual drag-and-drop ranking with persistence
- **Buyer Enrichment**: AI-powered data enrichment from web sources
- **Introductions**: Generate and manage buyer-seller introductions

#### 4. M&A Intelligence Module
Deal tracking and buyer intelligence across industry trackers.
- Industry tracker management
- Cross-tracker buyer and deal views
- Activity logging and engagement tracking

### State Management Patterns

The application uses **TanStack React Query** for all server state:

```typescript
// Data fetching with automatic caching
const { data: buyers } = useQuery({
  queryKey: ['remarketing-buyers', universeId],
  queryFn: () => supabase.from('remarketing_buyers').select('*').eq('universe_id', universeId),
});

// Mutations with cache invalidation
const mutation = useMutation({
  mutationFn: (data) => supabase.from('remarketing_buyers').update(data),
  onSuccess: () => queryClient.invalidateQueries(['remarketing-buyers']),
});
```

### Authentication Flow

```
User Login → Supabase Auth → JWT Token → Stored in localStorage
     │
     ├── AuthContext provides user state to all components
     ├── ProtectedRoute checks auth + role before rendering
     └── supabase.auth.getSession() used in edge functions
```

Roles: `admin`, `user`, `pending_approval`

## Backend Architecture

### Edge Function Categories

The 89 edge functions are organized into these functional groups:

| Category | Count | Purpose |
|----------|-------|---------|
| **AI & Enrichment** | 19 | AI-powered data extraction, enrichment, and generation |
| **Scoring & Matching** | 9 | Buyer-deal scoring, ranking, and criteria parsing |
| **Email & Notifications** | 26 | Transactional emails and in-app notifications |
| **Data Import/Export** | 6 | CSV import, bulk operations, data mapping |
| **Security & Auth** | 6 | Rate limiting, session security, password management |
| **Session Tracking** | 5 | User sessions, engagement signals, heartbeats |
| **Chat & Queries** | 3 | AI chat for buyer queries and remarketing |
| **Admin & Analytics** | 6 | Digest, metrics aggregation, analytics |
| **Scraping & External** | 5 | Web scraping, LinkedIn, Google reviews |
| **Background Processing** | 2 | Long-running async operations |
| **Utilities** | 2 | Guide PDF generation, platform verification |

### Shared Modules (`_shared/`)

| Module | Purpose |
|--------|---------|
| `ai-client.ts` | Unified AI provider interface (Gemini, Claude, OpenAI) with retry logic and cost tracking |
| `ai-providers.ts` | API endpoints, model mappings, and configuration for all AI providers |
| `security.ts` | Rate limiting (currently set to unlimited), SSRF protection |
| `validation.ts` | Anti-hallucination guards: placeholder detection, numeric range validation, address cross-validation |
| `buyer-criteria-extraction.ts` | Shared extraction logic for buyer criteria from M&A guides |
| `geography.ts` | US state normalization and local context detection |
| `geography-utils.ts` | Additional geographic utility functions |
| `criteria-validation.ts` | Criteria quality validation |
| `source-priority.ts` | Data source priority ranking |
| `admin-profiles.ts` | Admin profile utilities |

### AI Provider Configuration

```
Primary: Gemini 2.0 Flash (gemini-2.0-flash)
  - Used for: enrichment, scoring, chat, extraction
  - API: OpenAI-compatible endpoint with x-goog-api-key header

Secondary: Claude (claude-sonnet-4-20250514)
  - Used for: buyer criteria extraction, complex analysis
  - API: Anthropic native API

Fallback: Claude Haiku (claude-3-5-haiku-20241022)
  - Used for: fast, low-cost operations

Pro: Gemini 2.0 Pro (gemini-2.0-pro-exp)
  - Used for: M&A guide generation (13-phase process)
```

### Background Processing Pattern

For operations that exceed Supabase's ~150s edge function timeout:

```
1. Client calls background endpoint (e.g., generate-ma-guide-background)
2. Edge function creates tracking record in database
3. Returns HTTP 202 immediately with tracking ID
4. Background processing continues asynchronously
5. Updates progress in database (ma_guide_generations / buyer_criteria_extractions)
6. Client polls database every 2 seconds for progress
7. Auto-resumes monitoring on page reload
```

Used by: `generate-ma-guide-background`, `extract-buyer-criteria-background`

### Queue Processing Pattern

For batch operations that process items concurrently:

```
1. Items added to queue table (enrichment_queue / buyer_enrichment_queue)
2. Cron job or manual trigger invokes processor
3. Processor claims items with FOR UPDATE SKIP LOCKED (prevents race conditions)
4. Processes up to N items concurrently (default: 5)
5. Updates status: pending → processing → completed/failed
6. Stale items (stuck >10 min) recovered automatically
```

Used by: `process-enrichment-queue`, `process-buyer-enrichment-queue`

## Database Architecture

### Core Tables (99 total)

#### Deal Management
- `deals` - Core deal/listing data with 50+ fields
- `deal_stages` - Pipeline stage tracking
- `deal_activities` - Activity log per deal
- `deal_comments` - Team comments on deals
- `deal_notes` - Rich text notes
- `deal_contacts` - Contact information
- `deal_tasks` - Task management
- `deal_alerts` - Alert configuration
- `deal_referrals` - Referral tracking
- `deal_scoring_adjustments` - Manual score overrides
- `deal_ranking_history` - Ranking change audit trail

#### Buyer Management
- `buyers` - Core buyer data (PE firms, platforms, strategics)
- `buyer_contacts` - Buyer contact details
- `buyer_deal_scores` - AI-generated buyer-deal fit scores
- `buyer_enrichment_queue` - Async enrichment queue
- `buyer_criteria_extractions` - Extracted criteria from guides
- `buyer_transcripts` - Uploaded buyer transcripts
- `buyer_learning_history` - AI learning feedback loop
- `buyer_approve_decisions` / `buyer_pass_decisions` - Decision tracking

#### ReMarketing
- `remarketing_buyers` - Buyers within universes
- `remarketing_buyer_universes` - Industry-specific buyer groups
- `remarketing_universe_deals` - Deals assigned to universes
- `remarketing_scores` - AI scoring results
- `remarketing_outreach` - Outreach tracking
- `remarketing_buyer_contacts` - Universe-specific contacts
- `remarketing_guide_generation_state` - Guide generation state

#### M&A Intelligence
- `industry_trackers` - Industry tracking configurations
- `industry_classifications` - Industry taxonomy

#### User & Auth
- `profiles` - User profiles with role information
- `user_roles` - Role assignments
- `user_sessions` - Session tracking
- `user_events` - Event logging
- `user_journeys` - User journey tracking

#### Platform Operations
- `connection_requests` - Buyer-seller connection flow
- `listings` - Public marketplace listings
- `firm_agreements` - Fee agreements
- `inbound_leads` - Lead capture
- `platform_contacts` - Platform contact directory

### Key Database Patterns

1. **Row Level Security (RLS)**: All tables have RLS policies restricting access by user role
2. **Soft Deletes**: Most tables use `status` fields rather than hard deletes
3. **Audit Trails**: `created_at`, `updated_at` timestamps on all tables
4. **UUID Primary Keys**: All tables use UUID v4 primary keys
5. **JSONB Metadata**: Complex/flexible data stored in JSONB columns
6. **Database Functions**: 20+ PostgreSQL functions for complex operations

## Security Architecture

### Authentication Layers

1. **Supabase Auth**: JWT-based authentication with email/password
2. **Row Level Security**: PostgreSQL RLS policies on every table
3. **Edge Function Auth**: JWT verification in function handlers
4. **Role-Based Access**: Admin, user, and pending_approval roles
5. **Service Role**: Used for server-to-server operations (cron jobs, background processing)

### Security Modules

- **Rate Limiting** (`security.ts`): Sliding window rate limiter (currently set to unlimited per user request)
- **SSRF Protection** (`security.ts`): Prevents internal network access from scraping functions
- **Anti-Hallucination** (`validation.ts`): Validates AI-extracted data against realistic ranges
- **Input Validation**: UUID validation, required field checks
- **OTP Rate Limiting** (`otp-rate-limiter`): Prevents OTP brute-force attacks
- **Session Security** (`session-security`): Validates session integrity

### Authentication Status by Function Category

| Category | Auth Status |
|----------|-------------|
| Admin operations | Admin auth required |
| User operations | User auth required |
| Background processors | Service role or admin |
| Webhook/cron handlers | Service role only |
| Public endpoints | No auth (marketplace) |

## Data Flow: Key Workflows

### 1. M&A Guide Generation Flow

```
Admin triggers guide generation
  → generate-ma-guide-background (HTTP 202)
  → Creates ma_guide_generations record
  → Runs 13-phase AI generation with Gemini Pro
  → Updates progress in database (phase 1/13, 2/13, ...)
  → Frontend polls every 2 seconds
  → Completed guide stored in remarketing_buyer_universes.guide_content
```

### 2. Buyer Enrichment Flow

```
Admin adds buyer to universe
  → Buyer added to buyer_enrichment_queue
  → process-buyer-enrichment-queue runs (cron or manual)
  → For each buyer (5 concurrent):
    → enrich-buyer: 6 parallel AI calls via Promise.allSettled
      → Business overview, customer profile, geography
      → Acquisitions history, PE activity, portfolio
    → Anti-hallucination validation on extracted data
    → Results stored in remarketing_buyers
```

### 3. Buyer-Deal Scoring Flow

```
Admin triggers scoring for a deal
  → score-buyer-deal evaluates each buyer
  → Factors: industry alignment, geography, size, services
  → Uses M&A guide context for industry-specific evaluation
  → Scores stored in buyer_deal_scores / remarketing_scores
  → Admin can manually adjust with deal_scoring_adjustments
```

### 4. Industry Fit Scoring Flow

```
Admin triggers industry fit for buyer + deal
  → score-industry-alignment called
  → Reads full M&A guide (no character limit)
  → AI evaluates buyer's industry alignment against guide
  → Returns score 0-100 with detailed reasoning
  → Requires M&A guide (returns 400 if missing)
```

## Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| Parallel AI calls in enrich-buyer | 90s → 45s (50% reduction) |
| Chat context size reduction | 300KB → 25KB (92% reduction) |
| Background processing for long operations | Eliminates timeout failures |
| FOR UPDATE SKIP LOCKED in queues | Prevents race conditions |
| Stale operation recovery | Auto-marks stuck ops as failed after 10 min |
| Database indexes | 30+ strategic indexes on frequently queried columns |

## Environment Variables

Edge functions require these environment variables (set in Supabase dashboard):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `SUPABASE_ANON_KEY` | Anonymous key for public operations |
| `GEMINI_API_KEY` | Google Gemini AI API key |
| `ANTHROPIC_API_KEY` | Claude/Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `RESEND_API_KEY` | Resend email service key |
| `APIFY_API_TOKEN` | Apify web scraping token |
| `FIRECRAWL_API_KEY` | Firecrawl scraping key |
| `MAPBOX_TOKEN` | Mapbox GL maps token |

## Deployment

The platform is deployed via **Lovable**:

- **Frontend**: Auto-deployed on git push via Lovable CI/CD
- **Edge Functions**: Deployed via Supabase CLI or Lovable deployment prompts
- **Database Migrations**: Applied via Supabase migration system (`supabase/migrations/`)
- **Environment**: Production Supabase project at `vhzipqarkmmfuqadefep.supabase.co`
