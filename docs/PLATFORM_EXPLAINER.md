# SourceCo Platform — Complete Guide

**For: Dan, the deal team, and anyone onboarding onto the SourceCo platform**
**Last updated: February 2026**

---

## What Is SourceCo?

SourceCo is an M&A advisory platform that helps a deal team find buyers for businesses they're selling. The platform has two sides:

1. **The Marketplace** — A public-facing website where registered buyers browse anonymized deal listings, request access, sign NDAs and fee agreements, and enter the deal process.

2. **The Admin Platform** — The internal tool where the SourceCo deal team manages everything: deal pipeline, buyer outreach, call transcripts, document distribution, scoring, enrichment, email campaigns, task management, and an AI assistant that ties it all together.

The entire system runs on:
- **Frontend**: React + TypeScript SPA built with Vite, deployed as a static site
- **Backend**: Supabase (PostgreSQL database, Auth, Edge Functions in Deno, Storage, Realtime subscriptions)
- **AI**: Claude (Anthropic) for extraction, enrichment, chatbot, and memo generation; Gemini 2.0 Flash for lighter extraction tasks
- **Integrations**: Fireflies.ai (call transcripts), Smartlead (email campaigns), PhoneBurner (calling sessions), DocuSeal (e-signatures), Firecrawl (web scraping), Apify (LinkedIn scraping), Brevo (transactional email), Mapbox (maps)

---

## Table of Contents

1. [Users and Roles](#1-users-and-roles)
2. [The Marketplace (Buyer Side)](#2-the-marketplace-buyer-side)
3. [Admin Dashboard — Your Home Base](#3-admin-dashboard--your-home-base)
4. [Deal Pipeline](#4-deal-pipeline)
5. [Remarketing — Outbound Buyer Work](#5-remarketing--outbound-buyer-work)
6. [Buyer Management](#6-buyer-management)
7. [Buyer Scoring and Matching](#7-buyer-scoring-and-matching)
8. [Data Room and Documents](#8-data-room-and-documents)
9. [AI Memo Generation](#9-ai-memo-generation)
10. [Email Campaigns and Outreach](#10-email-campaigns-and-outreach)
11. [Call Transcripts and Fireflies](#11-call-transcripts-and-fireflies)
12. [Task Management](#12-task-management)
13. [AI Command Center (Chatbot)](#13-ai-command-center-chatbot)
14. [M&A Intelligence Module](#14-ma-intelligence-module)
15. [Agreements — NDAs and Fee Agreements](#15-agreements--ndas-and-fee-agreements)
16. [Approvals and Connection Requests](#16-approvals-and-connection-requests)
17. [Lead Sources](#17-lead-sources)
18. [Enrichment System](#18-enrichment-system)
19. [Notifications](#19-notifications)
20. [Message Center](#20-message-center)
21. [Analytics](#21-analytics)
22. [Settings and Admin Tools](#22-settings-and-admin-tools)
23. [Key Concepts Glossary](#23-key-concepts-glossary)

---

## 1. Users and Roles

### Three Roles

| Role | Access | Who |
|------|--------|-----|
| **Owner** | Everything. Can manage roles, delete users, access data recovery. | Dan, founders |
| **Admin** | Full admin platform access. Cannot manage roles or delete users. | Deal team members, analysts |
| **User** | Marketplace only. Can browse deals, request connections, sign agreements. | Buyers |

Roles are stored in the `user_roles` table. The `profiles.is_admin` flag is auto-synced from `user_roles` via a database trigger — you never need to update it manually.

### How Buyers Sign Up

1. Buyer visits the marketplace and clicks "Sign Up"
2. Multi-step signup: email/password → personal info → company info → investment criteria (buyer type, target industries, locations, revenue range, EBITDA range)
3. Email verification sent
4. Once verified, buyer lands on a "Pending Approval" page
5. An admin reviews the buyer in the Approvals queue and approves or rejects
6. Approved buyers can browse active, non-internal listings

### Buyer Types

Buyers self-identify during signup as one of:
- Private Equity
- Family Office
- Search Fund
- Corporate / Strategic
- Independent Sponsor
- Advisor
- Individual
- Business Owner

This affects priority scoring (PE firms score higher for outreach prioritization) and which listings they can see (admins can restrict listings by buyer type).

---

## 2. The Marketplace (Buyer Side)

### What Buyers See

**Marketplace page** (`/marketplace`): A grid of active deal listings. Each card shows:
- Anonymized title (e.g., "Established HVAC Services Company")
- Hero description
- Location (state/region, not exact)
- Revenue and EBITDA ranges
- Categories/tags
- "Request Access" button

Listings are ordered by `rank_order` (admin-controlled display priority). Internal-only deals (`is_internal_deal = true`) never appear on the marketplace.

**Listing Detail** (`/listing/:id`): Full detail page for a single listing with:
- Hero section with key metrics
- Executive summary (if available)
- Financial metrics (blurred until buyer has access)
- Deal advisor card
- Similar listings carousel
- "Request Connection" button — submits a connection request to the admin queue
- "Save" button — saves to the buyer's saved listings

**Saved Listings** (`/saved-listings`): Buyer's bookmarked deals.

**My Requests** (`/my-requests`): Status of all connection requests the buyer has submitted (pending, approved, rejected).

**Profile** (`/profile`): Buyer's profile with tabs for personal info, company info, investment criteria, and agreement status.

**Data Room Portal** (`/data-room/:dealId`): Once a buyer is approved for a deal and has signed agreements, they can access the data room — a secure document repository organized by folders (teasers, full memos, financial data, etc.). Every view and download is logged in `data_room_audit_log`.

### Agreement Flow

Before a buyer can access deal documents, two agreements are typically required:

1. **Fee Agreement** — A success fee agreement between SourceCo and the buyer's firm
2. **NDA** — A non-disclosure agreement for the specific deal

Both are managed through DocuSeal (e-signatures). Admins send agreements via email, buyers sign digitally, and the status is tracked per-user and per-firm. Firm-level agreements cover all members of that firm automatically.

---

## 3. Admin Dashboard — Your Home Base

**Route**: `/admin`

When you log in as an admin, you land on the Admin Dashboard. It has three switchable dashboards at the top:

### Daily Tasks Dashboard (Default)

The default view. Shows your team's task list from daily standups and manual task creation. See [Section 12: Task Management](#12-task-management) for full details.

### Remarketing Dashboard

Overview of the remarketing pipeline:
- Activity metrics and KPIs
- Recent deal activity
- Quick links to deals, buyers, universes

### Marketplace Dashboard

8 tabs covering the buyer-facing marketplace:

| Tab | What It Shows |
|-----|---------------|
| **Analytics** | Revenue metrics, marketplace health KPIs, signups, page views |
| **Overview** | Stripe payment overview and settlements |
| **My Deals** | Deals you own/created |
| **Listings** | All marketplace listings with management tools |
| **Users** | All marketplace buyer accounts with approval/rejection |
| **Activity** | Real-time activity feed across the platform |
| **Data** | Data recovery tools (owner-only) |
| **Forms** | Form submission health monitoring |

### Quick Actions (Top Right)

- **Settings** dropdown: Manage Permissions, Export Data
- **Notifications** bell with unread count
- **Refresh** button

---

## 4. Deal Pipeline

### Key Concept: Listings vs Deals

This is the single most important distinction in SourceCo:

- **Listing** = The sellside engagement. The company being sold. Stored in the `listings` table. Has a title, revenue, EBITDA, location, categories, status (active/inactive), and an internal company name visible only to admins.

- **Deal** = A buyer-deal pipeline entry. One buyer pursuing one listing. Stored in the `deals` table. Links a buyer (marketplace profile or remarketing buyer) to a listing with a stage, status, priority, and owner.

One listing can have many deals (many buyers pursuing the same company). One buyer can have many deals (pursuing multiple companies).

### Pipeline View

**Route**: `/admin/deals/pipeline`

Visual pipeline board showing deals organized by stage. Stages are customizable via `deal_stages` table (e.g., Lead → Qualified → NDA → CIM Sent → IOI → Management Presentation → LOI → Due Diligence → Closed). Each stage has a color and sort order.

**What you can do:**
- Drag deals between stages (or use the three-dot menu to move stage)
- Click a deal to open its detail view
- Filter by owner, status, priority, source
- See deal count and value per stage

### Deal Detail

**Route**: `/admin/deals/:dealId`

When you open a deal, you see:
- **Deal header**: Company name, stage badge, status, priority, owner
- **Tabs**:
  - **Overview** — Financial cards, score stats, pipeline stats, transcripts, data completeness
  - **Tasks** — Tasks specific to this deal (see Section 12)
  - **Activity** — Timeline of all actions on this deal
  - **Notes** — Internal team notes
  - **Comments** — @mention-enabled comments (triggers notification to mentioned admins)
  - **Contacts** — Contact persons associated with the deal
  - **Data Room** — Documents for this deal

### Deal Statuses

| Status | Meaning |
|--------|---------|
| `active` | Deal is live and being worked |
| `won` | Deal closed successfully |
| `lost` | Buyer passed or was rejected |
| `stalled` | Deal is inactive but not officially dead |

### Deal Sources

Deals can come from multiple channels:
- `marketplace` — Buyer requested access through the marketplace
- `remarketing` — Outbound buyer outreach
- `manual` — Admin created directly
- `captarget` — Imported from CapTarget lead source
- `gp_partners` — Referral from GP partners
- `referral` — Referral partner submission

### Automatic Deal Creation

When an admin approves a marketplace connection request, a deal is automatically created in the pipeline (via the `auto_create_deal_from_connection_request` trigger).

---

## 5. Remarketing — Outbound Buyer Work

Remarketing is the outbound side of SourceCo — proactively finding and contacting buyers for your listings, rather than waiting for them to come through the marketplace.

### Remarketing Dashboard

**Route**: `/admin` → switch to "Remarketing Dashboard"

Shows pipeline activity, deal metrics, and quick access to all remarketing tools.

### All Deals View

**Route**: `/admin/deals`

Unified view of all deals in the pipeline. Filterable by stage, owner, source, status, priority. Table view with sortable columns.

### All Buyers View

**Route**: `/admin/buyers`

The complete remarketing buyer database. These are external buyer profiles — PE firms, strategic acquirers, family offices — that are NOT marketplace users. They're stored in `remarketing_buyers` (separate from `profiles`).

Each buyer has:
- Company name, PE firm name, website, email domain
- HQ location (city, state)
- Target criteria: revenue range, EBITDA range, geographic targets, service/industry targets
- Buyer type
- Enrichment status (how complete their profile is)
- Deal breakers, strategic priorities, acquisition appetite
- Data completeness score

### Buyer Detail

**Route**: `/admin/buyers/:id`

Full buyer profile with tabs:
- **Overview** — All buyer data, enrichment status, data completeness
- **Contacts** — Contact persons at the firm (name, title, email, phone, primary contact flag)
- **Scores** — How this buyer scores against all active listings
- **Outreach** — History of all contact attempts
- **Transcripts** — Call transcripts involving this buyer
- **Deals** — All deals this buyer is involved in

### Buyer Universes

**Route**: `/admin/buyers/universes`

A "universe" is a named group of buyers for targeted outreach on a specific deal. For example: "ABC Plumbing — Southeast PE Firms" might contain 50 PE firms that target plumbing companies in the Southeast.

**How it works:**
1. Create a universe with filter criteria (geography, revenue range, industry, buyer type)
2. System queries `remarketing_buyers` matching those criteria
3. Review the universe members
4. Score all members against the listing
5. Send outreach (memos, emails) to the universe

Universes are linked to deals via `remarketing_universe_deals`.

### Deal Matching

**Route**: `/admin/remarketing/matching/:listingId`

The scoring and matching interface for a specific listing:
- See all scored buyers ranked by composite score
- Filter by tier (A/B/C/D/F), geography, buyer type
- View score breakdowns (geography score, size score, service score)
- Approve/pass/hide individual buyers
- Drill into buyer details

### Introductions

**Route**: `/admin/remarketing/introductions/:listingId`

Track which buyers have been introduced to a deal, via which channel, and what their response was.

---

## 6. Buyer Management

### Two Types of Buyers

SourceCo has two separate buyer systems:

| | Marketplace Buyers | Remarketing Buyers |
|---|---|---|
| **Table** | `profiles` | `remarketing_buyers` |
| **How they arrive** | Self-register on marketplace | Imported by admin, enriched by AI |
| **Authentication** | Have login credentials | No login — external contacts only |
| **Use case** | Inbound — they come to you | Outbound — you go to them |
| **Contacts** | Profile is the contact | Separate `remarketing_buyer_contacts` table |

A marketplace buyer can be linked to a remarketing buyer (same firm, different entry points). The deal pipeline handles both: `deals.buyer_id` links to marketplace profiles, `deals.remarketing_buyer_id` links to remarketing buyers.

### PE Firm Detail

**Route**: `/admin/buyers/pe-firms/:id`

Detailed view of a PE firm with all portfolio companies, contacts, investment criteria, and active deal involvement.

### Buyer Contacts

**Route**: `/admin/buyers/contacts`

Master contact list across all buyer sources. Searchable by name, email, company. Filterable by source and agreement status. Supports bulk email campaigns and contact export.

### Contact Lists

**Route**: `/admin/lists`

Curated, named contact lists for targeted outreach. Create lists, add/remove contacts, export for campaigns.

---

## 7. Buyer Scoring and Matching

### How Scoring Works

Every buyer-deal pair gets a composite score (0-100) computed across three dimensions:

| Dimension | What It Measures | Weight |
|-----------|-----------------|--------|
| **Geography** | How well the buyer's target geographies overlap with the listing's location. Uses state-level matching with adjacency bonuses (neighboring states score partial credit). | ~33% |
| **Size** | How well the buyer's target revenue/EBITDA range overlaps with the listing's financials. | ~33% |
| **Service/Industry** | How well the buyer's target industries/services match the listing's categories. | ~33% |

Weights are configurable and stored in `scoring_weights_history`.

### Score Tiers

| Tier | Score Range | Meaning |
|------|------------|---------|
| A | 80-100 | Excellent fit — prioritize outreach |
| B | 60-79 | Good fit — strong candidate |
| C | 40-59 | Moderate fit — worth considering |
| D | 20-39 | Weak fit — low priority |
| F | 0-19 | Poor fit — likely not relevant |

### Where Scores Live

Scores are stored in `remarketing_scores` with per-dimension breakdowns, the composite score, tier, AI-generated fit reasoning, and a status (pending, approved, passed, hidden).

### Scoring Queue

Scoring runs in the background via `remarketing_scoring_queue`. When a new listing is created or buyer data changes, scoring jobs are queued and processed by the `process-scoring-queue` edge function.

### Manual Overrides

Admins can override scores via `deal_scoring_adjustments` — useful when you have context the algorithm doesn't (e.g., "I know this buyer just closed a competing deal").

---

## 8. Data Room and Documents

### How the Data Room Works

Every listing has a data room — a secure document repository organized by category:

| Category | Access Level | What's In It |
|----------|-------------|--------------|
| **Anonymous Teaser** | Lowest barrier — usually available after initial approval | 1-2 page anonymized deal summary |
| **Full Memo** | Requires NDA | Detailed deal memo with company name, financials, operations |
| **Data Room** | Requires NDA + Fee Agreement | Full financial documents, tax returns, org charts, etc. |

### Access Control

Access is managed per-buyer, per-deal via `data_room_access`:
- `can_view_teaser` — Can see anonymized teaser
- `can_view_full_memo` — Can see full confidential memo
- `can_view_data_room` — Can access the full data room
- `fee_agreement_override` — Override the fee agreement requirement
- `expires_at` — Optional access expiration

### Document Tracking

Every action is logged in `data_room_audit_log`:
- Document views
- Downloads
- Access grants/revocations
- IP addresses

### Tracked Links

Admins can generate tracked document links via `document_tracked_links`. Each link has an open counter — you can see exactly how many times a buyer opened the teaser.

### Document Distribution

When memos are emailed to buyers, it's logged in `memo_distribution_log` with the recipient, channel, and timestamp.

---

## 9. AI Memo Generation

### What It Does

The `generate-lead-memo` edge function uses Claude to automatically generate deal memos from listing data.

Two types:
1. **Anonymous Teaser** — Anonymized 1-2 page overview. No company name, no identifying details. Designed to gauge buyer interest without revealing the target.
2. **Full Memo** — Detailed deal memo with company name, full financials, operations overview, growth opportunities. Only shared after NDA.

### How To Use It

From a listing detail page or deal detail page:
1. Click "Generate Memo" (or use the AI Command Center: "generate a teaser for ABC Plumbing")
2. Select memo type (anonymous teaser or full memo)
3. AI generates structured content based on all available listing data
4. Review and edit in the rich text editor
5. Publish or save as draft

Memos are versioned (`lead_memo_versions`) — every edit creates a new version. You can always see the history.

### Distribution

Once published, memos can be:
- Emailed directly to buyers via `send-memo-email`
- Shared via tracked links
- Made available in the data room

---

## 10. Email Campaigns and Outreach

### Smartlead Integration

Smartlead is the email campaign platform for outbound buyer outreach. It handles:
- Multi-step email sequences (initial outreach → follow-up 1 → follow-up 2)
- Email warm-up and deliverability
- Reply detection
- Bounce handling

**Route**: `/admin/smartlead/settings` for configuration
**Route**: `/admin/testing?tab=smartlead` for testing

### Outreach Tracking

Every contact attempt is logged in `outreach_records` and `remarketing_outreach`:
- Channel (email, call, memo, meeting)
- Status (sent, opened, replied, bounced, no_response)
- Timestamps (sent_at, response_at)

### Draft Outreach Emails

The `draft-outreach-email` edge function uses AI to generate personalized buyer outreach emails. Each email is tailored to the buyer's investment thesis, target geography, and revenue criteria — not a generic template.

### PhoneBurner Integration

**Route**: `/admin/phoneburner/sessions`

PhoneBurner is a power-dialing tool for phone outreach. The integration:
- Tracks calling sessions
- Logs call outcomes
- Syncs contact data

---

## 11. Call Transcripts and Fireflies

### What Fireflies Does

Fireflies.ai automatically records and transcribes team calls (deal discussions, buyer calls, seller calls, standups). The SourceCo integration:

1. **Syncs transcripts** — The `sync-fireflies-transcripts` edge function pulls transcripts from Fireflies
2. **Auto-pairs** — Matches transcripts to buyers and deals via email/name fuzzy matching
3. **Extracts insights** — AI pulls out key quotes, CEO detection, action items, and deal intelligence
4. **Enables search** — Full transcript content is stored for chatbot search

### Fireflies Admin Page

**Route**: `/admin/fireflies`

- **Sync All Transcripts** — One-click sync of recent transcripts (up to 500)
- **Bulk Sync** — Full historical sync of every transcript in the account
- **Stats cards**: Buyer transcripts linked, deal transcripts linked, auto-linked count
- **Recent pairings**: Shows the last 5 buyer and deal transcript matches

### Where Transcripts Live

Three tables store transcript data:
- `call_transcripts` — General call transcripts with listing and buyer links
- `deal_transcripts` — Transcripts linked to specific deals
- `buyer_transcripts` — Transcripts linked to specific buyers

Each has: transcript text, extracted insights, key quotes, CEO detection flag, call type.

### AI Task Extraction from Transcripts

The `extract-standup-tasks` edge function processes standup call transcripts through Claude to automatically extract action items. These become AI-suggested tasks in the Daily Tasks dashboard (see Section 12).

---

## 12. Task Management

### Current System: Daily Tasks

**Route**: `/admin/daily-tasks`

The task system tracks every action item from daily standups, deal calls, and manual work.

#### Dashboard Layout

- **4 KPI cards**: Open Tasks, Completed, Overdue, Completion Rate
- **Awaiting Approval section** (leadership only): AI-extracted tasks needing sign-off
- **My Tasks / All Tasks toggle**
- **Three sections**: Today & Overdue, Upcoming, Completed

Tasks are grouped by person — each person gets a card showing their assigned tasks.

#### Creating Tasks

**From Dashboard**: Click "+ Add Task" → fill in title, description, assignee, task type, due date, and deal reference.

**From Deal Detail**: Go to a deal's Tasks tab → click "Add Task" → fill in title, description, priority, assignee, due date.

#### Task Types
- Contact Owner
- Build Buyer Universe
- Follow Up with Buyer
- Send Materials
- Update Pipeline
- Schedule Call
- Other

#### Working With Tasks

- **Complete**: Click the checkbox. 5-second undo button appears.
- **View details**: Click any task card to open the detail popup (assignee, deal, due date, priority, pin status, transcript link)
- **Reassign**: Three-dot menu → Reassign, or change assignee in detail popup
- **Edit**: Three-dot menu → Edit Task
- **Pin** (leadership only): Three-dot menu → Pin to Rank (forces task to top of someone's list)
- **Delete**: Three-dot menu → Delete → confirm

#### AI-Extracted Tasks

When a standup is recorded via Fireflies:
1. Platform pulls the transcript
2. AI extracts action items
3. Tasks appear with "Awaiting Approval" status
4. Leadership reviews and clicks "Approve" or "Approve All"
5. Approved tasks move into the normal task list

#### Priority Scoring

Tasks are auto-scored based on:
- Deal stage (later stages score higher)
- Task type (Contact Owner = 90 pts, Update Pipeline = 30 pts)
- Overdue status (overdue tasks get boosted)
- Pin status (leadership pins override the algorithm)

#### Analytics

**Route**: `/admin/daily-tasks/analytics`

Three tabs:
- **Team Overview**: Total tasks, completion rate, overdue count, task volume trends, type breakdown, team leaderboard
- **Individual Scorecards**: Per-person stats with completion trends
- **Meeting Quality**: How well AI extraction is working

### Coming Soon: v3.1 Task System

The task system is being upgraded with: unified task inbox, snooze, task comments, templates, daily briefing emails, deal signals, buyer cadence tracking, team dashboards, bulk operations, and escalation tiers. See `docs/AI_TASK_SYSTEM_v3.1.md` for the full spec.

---

## 13. AI Command Center (Chatbot)

### What It Is

The AI Command Center is a conversational AI assistant embedded in the admin platform. It lets you query, analyze, and act on data across the entire SourceCo ecosystem through natural language.

### How to Open It

- **Keyboard shortcut**: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Click**: Chat icon in the top navigation bar
- Available from every admin page

### What It Can Do

**Deal Pipeline Intelligence**:
- "What are my most active deals?"
- "Which deals are stalled in due diligence?"
- "What happened on the Acme Corp deal this week?"

**Follow-Up Management**:
- "Who do I need to follow up with?"
- "What are my overdue tasks?"
- "Which buyers haven't responded to outreach in 2 weeks?"

**Buyer Intelligence**:
- "Do we have any HVAC companies in Florida?"
- "Find PE firms that acquire plumbing companies in the Southeast"
- "Who are the top-scored buyers for the ABC Plumbing deal?"

**Meeting Intelligence**:
- "What did the CEO say about timing in the last call?"
- "Summarize my meeting with John from Summit Capital"
- "What action items came out of the Acme Corp call?"

**Content Generation**:
- "Prepare me for my meeting with Summit Capital about Acme Corp"
- "Draft outreach to Tier A buyers for the Acme Corp deal"
- "Give me a weekly pipeline report"

**Daily Briefing**:
- "Give me my morning briefing"
- "What needs my attention today?"

### How It Works Under the Hood

1. **Intent Classification**: Your query is classified by Claude Haiku into a category (pipeline analytics, deal status, buyer intelligence, task management, etc.) and a processing tier (quick, standard, deep)
2. **Tool Selection**: Based on the category, the system selects which database queries and API calls to make
3. **Parallel Execution**: Tools run in parallel for speed (target: <3 seconds for standard queries)
4. **Response Generation**: Claude Sonnet (or Opus for deep analysis) synthesizes the results into a natural language response
5. **Streaming**: Response streams to you token-by-token so you see results immediately

### Context Awareness

- **Page context**: If you're on a deal page, the chatbot knows which deal you're looking at
- **User context**: It knows your deals, your role, your team
- **Conversation memory**: Follow-up questions work ("tell me more about the first one")
- **Conversation persistence**: Chats are saved and auto-resumed when you reopen

### Usage Limits

- 120 queries/hour per user
- Cost tracking per query (target: <$0.03 average)
- Token usage logged for monitoring

### Remarketing Chat

There's also a dedicated remarketing chat panel (`ReMarketingChat`) that appears on remarketing pages with context-specific buyer and deal intelligence. It uses the `chat-remarketing` edge function and supports context scoping (per-universe, per-deal, per-buyer).

---

## 14. M&A Intelligence Module

### What It Is

A separate module for tracking M&A deal flow from external sources — industry trackers, deal databases, and third-party research.

**Route**: `/admin/ma-intelligence`

### Pages

| Page | Route | What It Does |
|------|-------|--------------|
| **Dashboard** | `/admin/ma-intelligence` | Overview of tracked deals and buyers |
| **Trackers** | `/admin/ma-intelligence/trackers` | Industry-specific deal trackers (e.g., "HVAC M&A in Southeast") |
| **Tracker Detail** | `/admin/ma-intelligence/trackers/:id` | Individual tracker with tracked companies, activity log |
| **All Buyers** | `/admin/ma-intelligence/buyers` | M&A buyer database (separate from remarketing) |
| **Buyer Detail** | `/admin/ma-intelligence/buyers/:id` | Full buyer profile with matched deals |
| **All Deals** | `/admin/ma-intelligence/deals` | All tracked M&A deals |
| **Deal Detail** | `/admin/ma-intelligence/deals/:dealId` | Individual deal with tabs: Overview, Matched Buyers, Transcripts, Data Room, Activity, Settings |

### Deal Detail Tabs (MA Intelligence)

- **Overview**: Company information (editable), financial data
- **Matched Buyers**: Which buyers match this deal with scores
- **Transcripts**: Call transcripts with key insights
- **Data Room**: Documents accessible to buyers
- **Activity**: Deal activity log
- **Settings**: Archive, delete operations

### Deal Page System

The M&A Intelligence deal page has a sophisticated AI-powered data extraction system:

- **Multi-source extraction**: Transcripts (highest priority), Notes (medium), Website (lowest)
- **AI-powered parsing**: Extracts revenue, EBITDA, geography, service mix, owner goals from unstructured text
- **Confidence tracking**: High/medium/low confidence for financial data
- **Source provenance**: Tracks which source provided each data field
- **Auto-enrichment**: Automatically enriches deals when viewed (if stale data or missing fields)
- **Priority-based updates**: Higher-priority sources protect their data from being overwritten by lower-priority sources

---

## 15. Agreements — NDAs and Fee Agreements

### Two Levels of Agreement Tracking

1. **Per-User**: `profiles.nda_signed` and `profiles.fee_agreement_signed` — boolean flags on individual buyer profiles
2. **Per-Firm**: `firm_agreements` table — tracks agreement status at the firm level. When a firm signs, all members are covered.

### Firm Agreement System

**Route**: `/admin/firm-agreements`

- **Firm table**: Shows all firms with fee agreement status, NDA status, member count
- **Expandable rows**: Click a firm to see all members
- **Bulk actions**: Send fee agreements/NDAs to all firm members at once
- **Auto-linking**: When a new user signs up, they're automatically linked to their firm via email domain matching

### Agreement Flow

1. Admin sends NDA or Fee Agreement via DocuSeal (e-signature)
2. Buyer receives email with signing link
3. Buyer signs digitally
4. DocuSeal webhook fires → `docuseal-webhook-handler` processes it
5. Status updated on profile and firm records
6. All related connection requests and deals are updated

### Document Tracking Page

**Route**: `/admin/documents`

Tracks all NDAs and Fee Agreements sent across the platform:
- Stats: Total sent, signed, awaiting signature, declined/expired
- Sortable table with status badges (signed=green, sent=amber, declined=red)
- Search by company, contact, or deal name
- Filter by document type and status

---

## 16. Approvals and Connection Requests

### Connection Request Flow

1. Buyer requests access to a listing on the marketplace
2. Request lands in the admin queue with status "pending"
3. Admin reviews buyer info, company, message
4. Admin approves or rejects
5. If approved → deal is auto-created in pipeline, buyer gets access notification
6. If rejected → buyer gets notification

### Approvals Page

**Route**: `/admin/approvals`

Cross-deal approval queue:
- **Filter tabs**: Pending, Approved, Declined, All
- **For each entry**: Buyer info, firm, match confidence (Email Match, Firm Match, No Match), status, message, associated deal
- **Approve action**: Generates teaser link automatically
- **Decline action**: Opens dialog with category (Not Qualified, Wrong Size/Fit, Competitor, Duplicate, Other), reason text, and option to send email

### Connection Requests Page

**Route**: `/admin/marketplace/requests`

Two tabs:
1. **Connection Requests**: All buyer requests with advanced filters (status, buyer type, NDA status, fee agreement status), sortable table or grid view
2. **Inbound Leads**: External lead submissions that can be mapped to listings and converted to connection requests

---

## 17. Lead Sources

SourceCo ingests deal leads from multiple external sources:

### CapTarget Deals

**Route**: `/admin/remarketing/leads/captarget`

CapTarget is an external deal sourcing platform. Data syncs via Google Sheets integration (`sync-captarget-sheet` edge function). Shows sourced deals with sync status tracking.

### GP Partner Deals

**Route**: `/admin/remarketing/leads/gp-partners`

General Partner referral deals. Referral partners submit deal opportunities that the team evaluates.

### Valuation Leads

**Route**: `/admin/remarketing/leads/valuation`

"How much is my business worth?" inquiries. Business owners submit valuation requests, which become potential deal leads. Scored via `calculate-valuation-lead-score`.

### Referral Partners

**Route**: `/admin/remarketing/leads/referrals`

Referral partner program. Partners submit deals, tracked in `referral_submissions` with referral partner profiles in `referral_partners`.

### Owner Leads

**Route**: `/admin/settings/owner-leads`

"Sell with SourceCo" inquiry leads from the public website. Business owners expressing interest in selling.

### Inbound Leads

Leads from external sources (Webflow forms, website contact forms, API imports) stored in `inbound_leads`. Can be converted to marketplace connection requests.

---

## 18. Enrichment System

### What Enrichment Does

Enrichment is the process of automatically filling in missing data on buyer and deal profiles using AI and web scraping.

### How It Works

1. **Web scraping**: Firecrawl scrapes the company website
2. **AI extraction**: Claude or Gemini extracts structured data (company overview, geography, services, financials, employee count, founded year, etc.)
3. **LinkedIn scraping**: Apify scrapes LinkedIn for contact discovery
4. **Provenance tracking**: Every field tracks its source (transcript, notes, website) and priority level

### Three Enrichment Queues

| Queue | Edge Function | What It Enriches |
|-------|--------------|-----------------|
| **Deal Enrichment** | `enrich-deal` | Listing/deal profiles — company overview, geography, financials from website + AI |
| **Buyer Enrichment** | `enrich-buyer` | Remarketing buyer profiles — company info, contacts, investment criteria from website + AI |
| **Scoring** | `process-scoring-queue` | Buyer-deal match scores |

### Enrichment Queue Page

**Route**: `/admin/settings/enrichment-queue`

Three tabs showing each queue's status:
- Stats cards: Total, Pending, Processing, Completed, Failed
- Progress bar
- Recent items table (last 24 hours) with status, attempt count, last error
- "Clear Failed" button
- Auto-refreshes every 15 seconds

### Source Priority System

Data sources have priority levels to prevent lower-quality data from overwriting better data:

| Source | Priority | Overwrites |
|--------|----------|-----------|
| Transcript | 100 (highest) | Everything |
| Notes | 80 | Website data only |
| Website | 60 (lowest) | Only fills empty fields |

---

## 19. Notifications

### Admin Notifications

**Route**: `/admin/settings/notifications`

In-app notification system:
- **Unread** and **Earlier** sections
- Each notification shows: title, message, deal info, priority badge, timestamp
- Click to navigate to the associated deal/action
- "Mark all as read" button
- Grouped notifications for repeated events

### Notification Types

- `task_assigned` — Someone assigned you a task
- `task_completed` — A task you created was completed
- Deal stage changes
- New connection requests
- Buyer responses to outreach
- Agreement status changes
- Score changes
- New lead matches

### Email Notifications

The platform sends transactional emails via Brevo for:
- User approval/rejection
- Connection request updates
- NDA/Fee agreement requests and reminders
- Deal alerts (new listing matches buyer criteria)
- Task assignments
- Password reset
- Email verification
- Admin digest (daily summary)
- Owner inquiry notifications
- Deal referral notifications

---

## 20. Message Center

**Route**: `/admin/marketplace/messages`

Centralized inbox for all buyer-admin conversations:

- **Split-pane interface**: Thread list (left) + message view (right)
- **View modes**: All Messages (chronological) or By Deal (grouped by listing)
- **Filter tabs**: All, Unread, Needs Reply, Waiting, Closed
- **Thread info**: Buyer name, company, last message preview, unread badge, claimed-by admin, deal link
- **Search**: Across buyer names, companies, email, deal titles
- **Actions**: Mark as read, claim thread, reply, change status

Messages between buyers and admins are stored in `connection_messages` and protected by an immutability trigger (messages can't be edited after sending).

---

## 21. Analytics

### Remarketing Analytics

**Route**: `/admin/analytics`

Deal and buyer analytics dashboard:
- Pipeline conversion rates
- Deal velocity by stage
- Buyer outreach effectiveness
- Score distribution
- Activity trends

### Transcript Analytics

**Route**: `/admin/analytics/transcripts`

Call transcript analytics:
- Transcript volume over time
- Topic extraction trends
- Meeting quality metrics
- CEO engagement rates

### Marketplace Analytics

Available in the Admin Dashboard → Marketplace Dashboard → Analytics tab:
- Active listings count
- Total users and new signups
- Connection requests and approval rates
- Page views and session data
- Engagement metrics

### Daily Metrics

Aggregated daily metrics computed by cron job (`aggregate-daily-metrics`):
- Signups, page views, connections, session counts
- Stored in `daily_metrics` for trend analysis

### User Analytics

Detailed tracking across:
- `user_sessions` — Session start/end, pages viewed, device info
- `page_views` — Individual page views
- `user_events` — Custom interaction events
- `user_activity` — Detailed action tracking
- `user_journeys` — Cross-domain attribution, first-touch tracking
- `engagement_signals` — Real-time engagement signals
- `listing_analytics` — Per-listing view and engagement metrics
- `search_analytics` — Search query and result tracking
- `registration_funnel` — Signup funnel step tracking

---

## 22. Settings and Admin Tools

### Team Management

**Route**: `/admin/settings/team`

- View all team members (owners, admins, moderators)
- Invite new team members
- Audit log of permission changes

### Security Settings

**Route**: `/admin/settings/security`

Security policies and access controls.

### Webhooks

**Route**: `/admin/settings/webhooks`

Manage webhook integrations for external service callbacks.

### Smartlead Settings

**Route**: `/admin/settings/smartlead`

Configure Smartlead API credentials and campaign settings.

### PhoneBurner Settings

**Route**: `/admin/phoneburner/settings`

Configure PhoneBurner integration for power dialing.

### Remarketing Settings

**Route**: `/admin/settings/remarketing`

Configure remarketing campaign parameters.

### Testing Hub

**Route**: `/admin/testing`

Unified testing dashboard with 6 tabs:

| Tab | What It Tests |
|-----|--------------|
| **Enrichment Test** | Deal/buyer enrichment APIs and scoring (uses real APIs — consumes credits) |
| **System Tests** | System integration and API health |
| **DocuSeal Health** | Document signing service health |
| **Smartlead** | Email campaign integration |
| **AI Chatbot** | Chatbot QA and response testing |
| **30-Question QA** | Comprehensive questionnaire testing |

### Data Recovery

**Route**: `/admin/settings/data-recovery` (Owner-only)

System maintenance and data recovery tools. Includes profile data restoration from snapshots, orphaned user detection, and soft-delete recovery.

### Bulk CSV Import

Upload CSV files of buyer contacts with:
- Smart column mapping (AI-assisted via `map-csv-columns`)
- Data sanitization (company names, phone numbers, emails)
- 5-level duplicate detection
- Preview and validation before import
- Source metadata tracking

---

## 23. Key Concepts Glossary

| Term | Definition |
|------|-----------|
| **Listing** | A sellside engagement — the company being sold. Stored in `listings` table. |
| **Deal** | A buyer-deal pipeline entry — one buyer pursuing one listing. Stored in `deals` table. |
| **Remarketing Buyer** | An external buyer (PE firm, strategic acquirer) tracked for outbound outreach. Not a platform user. In `remarketing_buyers`. |
| **Marketplace Buyer** | A registered platform user who browses deals. In `profiles`. |
| **Universe** | A named grouping of buyers for targeted outreach on a specific deal. |
| **Score** | A composite buyer-deal fit score (0-100) across geography, size, and service dimensions. |
| **Tier** | Score classification: A (80-100), B (60-79), C (40-59), D (20-39), F (0-19). |
| **Pipeline Stage** | A step in the deal process (Lead → Qualified → NDA → CIM → IOI → LOI → DD → Closed). |
| **Connection Request** | A buyer's request to access a listing. Starts the deal relationship. |
| **Data Room** | Secure document repository for a deal. Three access tiers: teaser, full memo, data room. |
| **NDA** | Non-Disclosure Agreement. Required before sharing confidential deal details. |
| **Fee Agreement** | Success fee agreement between SourceCo and a buyer firm. |
| **Firm** | A company (usually a PE firm) that groups multiple buyer users under one agreement umbrella. |
| **Enrichment** | AI-powered process of filling in missing buyer or deal data from web scraping and LLM extraction. |
| **Outreach** | A contact attempt to a buyer (email, call, memo, meeting). |
| **CapTarget** | External deal sourcing platform synced via Google Sheets. |
| **GP Partners** | General Partner referral deal source. |
| **Fireflies** | Fireflies.ai — meeting recording and transcription service. |
| **Smartlead** | Email campaign platform for outbound buyer outreach. |
| **PhoneBurner** | Power-dialing tool for phone outreach. |
| **DocuSeal** | E-signature service for NDAs and fee agreements. |
| **Firecrawl** | Web scraping API used for enrichment. |
| **Brevo** | Transactional email service (formerly Sendinblue). |
| **Provenance** | Tracking which data source provided each field and at what priority level. |
| **RLS** | Row Level Security — PostgreSQL feature ensuring users can only see data they're authorized to access. |

---

## Quick Navigation Reference

### Core Workflows

| I want to... | Go to... |
|--------------|----------|
| See my tasks for today | `/admin` (Daily Tasks is the default) |
| View the deal pipeline | `/admin/deals/pipeline` |
| Find a buyer | `/admin/buyers` (remarketing) or `/admin/marketplace/users` (marketplace) |
| Score buyers for a listing | `/admin/remarketing/matching/:listingId` |
| Create a buyer universe | `/admin/buyers/universes` |
| Send a memo to buyers | Listing detail → Generate Memo → Send |
| Check buyer access to data room | Deal detail → Data Room tab |
| Review pending buyer approvals | `/admin/approvals` |
| Read buyer messages | `/admin/marketplace/messages` |
| Check enrichment queue status | `/admin/settings/enrichment-queue` |
| Sync Fireflies transcripts | `/admin/fireflies` |
| Manage team members | `/admin/settings/team` |
| Track NDAs and fee agreements | `/admin/documents` |
| Ask the AI anything | `Cmd+K` from any admin page |
| View analytics | `/admin/analytics` |
| See task analytics | `/admin/daily-tasks/analytics` |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open AI Command Center |

---

**END OF PLATFORM GUIDE**
**SourceCo — Confidential & Internal Use Only**
