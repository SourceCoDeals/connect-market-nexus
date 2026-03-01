# Marketplace Listing & Landing Page Audit

**Date:** February 28, 2026
**Scope:** Listing creation, AI automation, landing page generation, anonymous lead memos, signup funnels, and conversion tracking

---

## Executive Summary

This audit examines the end-to-end pipeline from deal ingestion through marketplace listing creation, public landing page generation, lead capture, and signup conversion. The platform has strong foundational infrastructure but has significant gaps in **automation** between deal enrichment and listing/landing page creation. The AI capabilities are concentrated on enrichment and memo generation, but the listing editor and landing page content still require heavy manual work.

**Key findings:**
1. Listing creation is manual-heavy — the anonymization pipeline exists but doesn't leverage AI to write compelling content
2. Landing pages use a single static template — no AI generates the custom_sections, investment_thesis, or other landing page content
3. The anonymous lead memo (generate-lead-memo) is excellent but disconnected from landing page creation
4. Signup funnels from landing pages work but have friction points and hardcoded contact info
5. Session/engagement tracking infrastructure is comprehensive

---

## 1. Marketplace Listing Creation Flow

### Current Pipeline

```
Deal (internal) → Marketplace Queue → CreateListingFromDeal → ImprovedListingEditor → Publish
```

**Key files:**
- `src/pages/admin/CreateListingFromDeal.tsx` — Initiates listing creation from deal
- `src/lib/deal-to-listing-anonymizer.ts` — Strips identifying info
- `src/components/admin/ImprovedListingEditor.tsx` — Main editor form
- `supabase/functions/publish-listing/index.ts` — Publication with quality validation

### What Works Well

- **Deal-to-Listing anonymizer** (`deal-to-listing-anonymizer.ts:51-135`): Thoroughly strips company names, contact info, emails, phone numbers, website domains, and all variations. Sorts by length to replace longest matches first.
- **Duplicate detection**: CreateListingFromDeal checks if a listing already exists for a deal via `source_deal_id`
- **Publication validation** (`publish-listing/index.ts:16-51`): Enforces minimum quality — title >=5 chars, description >=50 chars, category required, location required, revenue >0, image required
- **Rich text editor**: Uses a premium rich text editor for descriptions with HTML and JSON storage
- **Remarketing guard**: Prevents publishing listings linked to remarketing systems

### Gaps & Improvement Opportunities

#### GAP 1: Anonymous Title Generation Is Generic
**File:** `deal-to-listing-anonymizer.ts:167-186`
```
"Established {industry} Business in {state}"
```
Every listing title follows this exact pattern. There's no variation, no AI enhancement, and no compelling hook.

**Recommendation:** Add an AI title generation step that creates 3-5 compelling anonymous title options. The `generate-lead-memo` function already has the prompt infrastructure to understand anonymity rules — reuse that pattern for title generation.

#### GAP 2: Description Generation Uses Raw Anonymization Only
**File:** `deal-to-listing-anonymizer.ts:191-216`

The description is either:
- A find-and-replace anonymization of the executive summary
- A basic template: "An established {industry} business based in {state}" with revenue/employee counts

**Recommendation:** Route description generation through an AI step (like `generate-lead-memo`) that writes a compelling marketplace description from the enriched deal data while maintaining anonymity.

#### GAP 3: Hero Description Is Formulaic
**File:** `deal-to-listing-anonymizer.ts:221-239`
```
"Established {industry} business in {state} with ${revenue} in revenue and ${ebitda} EBITDA."
```

Every hero description follows the same pattern. This is the first thing buyers see on both the listing card and the landing page.

**Recommendation:** AI-generate hero descriptions (<=500 chars) that differentiate each listing with specific value propositions.

#### GAP 4: No Auto-Population of Landing Page Content Fields
The landing page renders these fields from the `listings` table but none are auto-populated by the anonymizer:
- `investment_thesis` — never populated during creation
- `custom_sections` (JSONB array) — never populated during creation
- `ownership_structure` — never populated during creation
- `seller_motivation` — never populated during creation
- `services` (array) — never populated during creation
- `growth_drivers` — never populated during creation
- `competitive_position` — never populated during creation
- `business_model` — never populated during creation
- `customer_geography` — never populated during creation
- `customer_types` — never populated during creation
- `revenue_model` — never populated during creation

**This is the single biggest gap.** The data for many of these fields already exists in the deal's enrichment data and transcripts (the `enrich-deal` function extracts `services`, `customer_segments`, `geographic_states`, etc.), but the CreateListingFromDeal pipeline doesn't map them.

**Recommendation:** Create a new edge function `generate-listing-content` that:
1. Takes a deal_id
2. Gathers all enriched data (transcripts, website scrape, LinkedIn, notes)
3. Generates all landing page content fields using AI while enforcing anonymity
4. Returns a complete listing payload ready for editor review

#### GAP 5: Listing Editor Has No AI Assistance
**File:** `src/components/admin/ImprovedListingEditor.tsx`

The editor is purely manual. There's no "Generate with AI" button for any field. The admin must write/edit every field by hand.

**Recommendation:** Add AI generation buttons on key fields:
- "Generate description" on the description section
- "Generate hero" on the hero description section
- "Suggest custom sections" that creates 3-4 investment-relevant sections from deal data
- "Auto-fill metrics" from enrichment data

#### GAP 6: Custom Metrics Not Auto-Populated
The editor has 4 customizable metrics (revenue, EBITDA, metric 3, metric 4) with labels, values, and subtitles. These are never auto-populated from deal data even when the data exists.

**Recommendation:** Auto-populate metric 3 from `full_time_employees` and metric 4 from `ebitda_margin` as defaults, with AI suggesting better options when richer data is available.

---

## 2. AI-Powered Automation

### What Exists Today

| Function | Purpose | AI Model | Status |
|----------|---------|----------|--------|
| `enrich-deal` | Extract data from transcripts, website, LinkedIn, Google reviews | Gemini | Production |
| `generate-lead-memo` | Generate anonymous teaser / full lead memo | Claude Sonnet | Production |
| `extract-deal-transcript` | Extract structured data from call transcripts | Gemini | Production |
| `analyze-deal-notes` | Analyze broker/admin notes | Gemini | Production |
| `clarify-industry` | Classify business into industry label | Gemini | Production |
| `score-buyer-deal` | Score buyer-deal fit | Gemini | Production |
| `generate-buyer-universe` | Generate target buyer profiles | Gemini | Production |

### What's Missing

| Needed Function | Purpose | Recommendation |
|-----------------|---------|----------------|
| `generate-listing-content` | Auto-generate all listing fields from deal data | New edge function using Claude |
| `generate-landing-page-sections` | Generate custom_sections, investment_thesis, etc. | Can be part of above |
| `generate-listing-titles` | Generate 3-5 compelling anonymous title options | Lightweight AI call |
| `generate-listing-description` | Generate anonymized marketplace description | Part of listing content generation |
| `enhance-listing-quality` | Review and improve existing listing content | Optional post-creation step |

### generate-lead-memo Analysis

**File:** `supabase/functions/generate-lead-memo/index.ts`

This is the most sophisticated AI function in the system and a good template for listing generation:

**Strengths:**
- Comprehensive data context builder (lines 232-311) that aggregates transcripts, enrichment, manual entries, and valuation data
- Source priority system: Transcripts > Notes > Enrichment > Manual entries
- Banned words enforcement (lines 316-336) — prevents "strong", "robust", "impressive", etc.
- Multi-branding support (sourceco, new_heritage, renovus, cortec)
- Detailed section-by-section prompt with few-shot examples
- Anonymous teaser follows strict anonymity rules with region-based codenames
- Audit logging and source tracking

**Issues:**
- Guard at line 82-95 requires Full Memo PDF to be uploaded before anonymous teaser generation — this creates a chicken-and-egg problem for new deals
- The function saves to `lead_memos` table but the output is NOT connected to the listing or landing page at all
- The anonymous teaser sections (company_overview, financial_overview, services_operations, etc.) map almost 1:1 to what landing page `custom_sections` needs, but they're never bridged

**Recommendation:** Create a pipeline that:
1. Runs `generate-lead-memo` with `memo_type: "anonymous_teaser"` (remove the PDF guard for this use case, or make it optional)
2. Maps the memo sections to listing fields:
   - `company_overview` → `description`
   - `financial_overview` → `custom_sections[0]`
   - `services_operations` → populate `services[]` array + `custom_sections[1]`
   - `growth_opportunities` → `investment_thesis` + `growth_drivers[]`
   - `transaction_overview` → `seller_motivation` + `ownership_structure`
   - etc.
3. Auto-populate the listing in the editor for admin review

---

## 3. Landing Page Creation & Content

### Current Architecture

**Route:** `/deals/:id`
**Components:** `src/pages/DealLandingPage/`

The landing page is a single responsive template that renders from `listings` table data:

```
LandingHeader → DealHero → MetricsStrip → ContentSections → DealRequestForm → DealSidebar → RelatedDeals
```

### What Works Well

- **Clean, professional design** — Well-structured layout with proper typography and spacing
- **Mobile-responsive** — Sidebar moves above content on mobile
- **Anonymous by design** — Page only shows fields from the `listings` table, which are already anonymized
- **Sticky sidebar** with clear CTAs on desktop
- **Custom metrics** — 4 configurable metric boxes with labels, values, and subtitles
- **Custom sections** — Flexible JSONB array allows unlimited content sections
- **Related deals** — Cross-promotion of other active listings
- **Executive summary download** — PDF link when available

### Landing Page Content Gaps

#### GAP 7: Landing Pages Are Usually Empty
Since the listing creation pipeline doesn't populate `investment_thesis`, `custom_sections`, `services`, `ownership_structure`, `seller_motivation`, etc., most landing pages will only show:
- Title (generic)
- Location
- Revenue and EBITDA metrics
- The raw anonymized description

The entire left column of content sections will be empty. The ownership callout section won't render. Services won't render. This makes landing pages thin and unconvincing.

**Recommendation:** The `generate-listing-content` function should populate all these fields during listing creation, giving every landing page rich content from day one.

#### GAP 8: No Landing Page Preview in Admin
Admins editing listings can't see what the public landing page will look like. There's an `EditorLivePreview.tsx` file in the editor sections but it's not integrated into the main editor.

**Recommendation:** Add a "Preview Landing Page" button or split-view in the listing editor that shows a live rendering of `DealLandingPage` with current form data.

#### GAP 9: Landing Page Doesn't Track Its Source
When anonymous visitors land on `/deals/:id`, the `useDealLandingPage` hook fetches listing data but doesn't record that a landing page view occurred for this specific listing.

The general `PageEngagementTracker` captures scroll depth and time-on-page, but listing-specific analytics (which listing was viewed) only works for authenticated users via `AnalyticsContext`.

**Recommendation:** Fire a listing-specific analytics event for anonymous landing page views. This is critical for measuring which landing pages convert.

#### GAP 10: No Dynamic Presented By
**File:** `DealSidebar.tsx:77-109`

The "Deal Presented By" section is hardcoded to Tomos Mughan. The listings table has a `presented_by_admin_id` field, but the landing page ignores it.

**Recommendation:** Fetch the presenting admin's profile and display their info dynamically, or use the `primary_owner_id` field.

---

## 4. Anonymous Lead Capture & Funnel

### Current Lead Capture Flow

```
Landing Page → DealRequestForm → connection_requests (source='landing_page') → Admin Pipeline
```

**File:** `src/hooks/useDealLandingFormSubmit.ts`

**Form fields:** Name*, Email*, Company, Phone*, Role*, Message*

### What Works Well

- **Direct Supabase insert** — No middleware needed, RLS policy allows anon inserts with `source='landing_page'`
- **Lead tracking fields** — Connection requests have 30+ fields for pipeline tracking (NDA status, fee agreement, quality scores, follow-up flags)
- **Source attribution** — `source: 'landing_page'` clearly identifies lead origin
- **Success state** — Shows confirmation with contact email

### Funnel Gaps

#### GAP 11: No Post-Submission Signup Nudge
**File:** `DealRequestForm.tsx:37-51`

After form submission, the success message only says "Thank you! We received your message..." with a contact email. There's no CTA to:
- Sign up for the marketplace
- Browse other deals
- Download something
- Schedule a call

This is the highest-intent moment for conversion and it's wasted.

**Recommendation:** After form submission, show:
1. "Your request is being reviewed" confirmation
2. "While you wait, browse 50+ similar deals on our marketplace" with a prominent signup CTA
3. "Schedule a buyer call" link
4. Related deals carousel (already exists as a component)

#### GAP 12: No Email Capture for Non-Submitters
The landing page only captures leads who fill out the full form. Visitors who scroll but don't submit are lost entirely.

**Recommendation:** Add a lightweight email-only capture (exit-intent or scroll-triggered) that collects just an email for deal alerts, with much lower friction than the full form.

#### GAP 13: Hardcoded Contact Info in Multiple Places
- `DealRequestForm.tsx:47` — Hardcoded `adam.haile@sourcecodeals.com`
- `DealSidebar.tsx:33` — Hardcoded Tidycal link for Tomos
- `DealSidebar.tsx:87-107` — Hardcoded Tomos Mughan contact info
- `LandingHeader.tsx:2-6` — Hardcoded nav links to sourcecodeals.com

**Recommendation:** Store the deal presenter's contact info in the database (linked to `presented_by_admin_id` or `primary_owner_id`) and render it dynamically.

#### GAP 14: Landing Page Sidebar "Browse Marketplace" Goes to External URL
**File:** `DealSidebar.tsx:66-73`
```
href="https://marketplace.sourcecodeals.com/signup"
```
This links to an external URL. If the landing page is served from the same domain as the marketplace, this should be an internal route (`/signup`). If cross-domain, UTM parameters should be appended for attribution.

**Recommendation:** Use the app's internal routing where possible. When linking externally, include UTM parameters: `?utm_source=landing_page&utm_medium=sidebar&utm_content=browse_marketplace&utm_campaign={deal_id}`

#### GAP 15: Related Deal Cards Also Link to External Signup
**File:** `RelatedDeals.tsx:102-110`

Every related deal card's CTA is "View on Marketplace" linking to `marketplace.sourcecodeals.com/signup`. These should link to the individual deal's landing page (`/deals/{id}`) so users can explore more deals without leaving the funnel. Then from there, they can sign up.

**Recommendation:** Change related deal CTAs to link to `/deals/{deal.id}` to keep users in the landing page funnel. Add marketplace signup CTA separately.

---

## 5. Signup & Conversion Flow

### Current Signup Architecture

**Route:** `/signup` (5-step form)
**Steps:** Account Info → Personal Details → Referral Source → Buyer Type → Buyer Profile

**Key files:**
- `src/pages/Signup/index.tsx` — Orchestrator with draft persistence
- `src/pages/Signup/types.ts` — 70+ form fields across buyer types
- `src/hooks/use-signup-analytics.ts` — Funnel step tracking

### What Works Well

- **Draft persistence** — Form data saved to localStorage (passwords excluded), resumes from last step
- **Buyer-type-specific fields** — Different fields for PE, corporate, family office, search fund, etc.
- **Registration funnel tracking** — Every step recorded with time spent and form data
- **Skip options** — Steps 3 (referral source) and 5 (buyer profile) can be skipped
- **Protected auth guards** — Prevents concurrent signups, rate limits attempts
- **Comprehensive session tracking** — UTM, referrer, GA4 client ID, cross-domain from sourcecodeals.com, ad click IDs (gclid, fbclid, li_fat_id)

### Signup Flow Issues

#### GAP 16: No Deal Context Preserved Through Signup
When a visitor comes from a landing page and clicks "Join the Marketplace", they navigate to `/signup` but lose all context about which deal brought them there. After signup and approval, they have to find that deal again.

**Recommendation:**
1. Append `?from_deal={deal_id}` to the signup URL from landing pages
2. Store in signup form data and persist through the flow
3. After approval, redirect to that deal's listing detail page or pre-save it
4. Track deal-attributed signups for ROI analysis

#### GAP 17: 5-Step Signup May Be Too Long for Landing Page Traffic
Landing page visitors have high intent for one specific deal. A 5-step signup form is a significant friction barrier. The "skip" options help but aren't prominent.

**Recommendation:** Consider a "fast-track" signup for landing page leads:
1. Capture email + password only (step 1)
2. Auto-populate name, company, phone from their landing page form submission if they already filled it out
3. Allow completing buyer profile later (during pending approval period)
4. The pending approval page already supports NDA signing — add profile completion there too

---

## 6. Tracking & Analytics

### What's Comprehensive

| Tracking Layer | Implementation | Tables |
|---------------|---------------|--------|
| Session tracking | `SessionTrackingProvider` wraps entire app | `user_sessions` |
| Page engagement | `PageEngagementTracker` — scroll depth, time, focus | `page_views` |
| Listing analytics | `AnalyticsContext` — views, saves, connections | `listing_analytics` |
| Registration funnel | `use-signup-analytics` — step-by-step tracking | `registration_funnel` |
| Click tracking | `use-click-tracking` — element, position, timing | In-memory (50 events) |
| First-touch attribution | `useVisitorIdentity` — persistent across sessions | `localStorage` |
| Cross-domain | sourcecodeals.com → marketplace handoff | URL params + localStorage |
| GA4 | Parallel tracking for all events | GA4 |

### Tracking Gaps

#### GAP 18: Landing Page → Signup Attribution Gap
While session-level UTM tracking exists, there's no direct attribution from a specific landing page view to a signup. If a visitor views `/deals/abc123`, leaves, and comes back to sign up 3 days later, the deal attribution is lost.

**Recommendation:** Use `useVisitorIdentity` to store the first deal landing page visited. Pass this through signup as `first_deal_viewed`. This enables measuring which deals drive the most signups.

#### GAP 19: No Landing Page Conversion Dashboard
The `ListingIntelligenceTab` tracks marketplace listing performance (views, saves, conversions for authenticated users), but there's no dashboard for landing page performance (anonymous views, form submissions, signup conversions).

**Recommendation:** Add a "Landing Page Analytics" tab or card showing:
- Views per landing page (anonymous + authenticated)
- Form submission rate
- Signup conversion rate (form submitters who become marketplace users)
- Related deal click-through rate

#### GAP 20: Click Tracking Not Persisted
**File:** `src/hooks/use-click-tracking.ts`

Click tracking keeps the last 50 clicks in memory but only flushes them with page engagement data. This means click data may be lost if the user navigates away quickly.

**Recommendation:** Consider batching click data with session heartbeat for more reliable persistence.

---

## 7. Proposed Automated Pipeline

### End-to-End Listing + Landing Page Automation

```
Step 1: Deal is enriched (enrich-deal) ← Already exists
         ↓
Step 2: Deal pushed to marketplace queue ← Already exists
         ↓
Step 3: NEW → generate-listing-content(deal_id)
         - Gathers all enriched data (transcripts, website, LinkedIn, notes)
         - Generates anonymous title (3 options)
         - Generates hero_description
         - Generates description (anonymized)
         - Generates investment_thesis
         - Generates custom_sections[] (3-5 sections)
         - Populates services[], growth_drivers[]
         - Populates ownership_structure, seller_motivation
         - Populates business_model, customer_geography, revenue_model
         - Calculates/suggests custom metrics
         - Returns complete listing payload
         ↓
Step 4: Admin reviews in ImprovedListingEditor ← Already exists (add AI buttons)
         - Pre-filled with AI content
         - Admin can edit, approve, regenerate any field
         - Live landing page preview
         ↓
Step 5: Admin uploads image + publishes ← Already exists
         ↓
Step 6: Landing page auto-generated from listing data ← Already exists
         ↓
Step 7: Share landing page URL for outreach
         - Landing page captures leads into connection_requests
         - Leads funnel to signup
         - Signup preserves deal context
         ↓
Step 8: Lead enters admin pipeline ← Already exists
```

### What Needs Building

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | `generate-listing-content` edge function | 2-3 days | Automates 80% of listing creation |
| P0 | Map enriched deal data to all landing page fields | 1 day | Populates empty landing pages |
| P1 | AI generate buttons in listing editor | 1-2 days | Per-field regeneration |
| P1 | Post-submission signup nudge on landing page | 0.5 day | Improves conversion |
| P1 | Preserve deal context through signup | 0.5 day | Attribution + UX |
| P1 | Dynamic "Presented By" from database | 0.5 day | Removes hardcoded contacts |
| P2 | Landing page preview in admin editor | 1-2 days | Admin UX |
| P2 | Landing page analytics dashboard | 1-2 days | ROI measurement |
| P2 | Related deals link to landing pages, not signup | 0.5 day | Keeps users in funnel |
| P2 | UTM params on cross-domain links | 0.5 day | Better attribution |
| P3 | Fast-track signup for landing page visitors | 1-2 days | Reduces friction |
| P3 | Exit-intent email capture on landing pages | 1 day | Captures more leads |

---

## 8. Summary of All Gaps

| # | Gap | Severity | Area |
|---|-----|----------|------|
| 1 | Anonymous title generation is generic/formulaic | High | Listing Creation |
| 2 | Description generation uses raw anonymization only | High | Listing Creation |
| 3 | Hero description is formulaic | High | Listing Creation |
| 4 | No auto-population of landing page content fields | Critical | Listing Creation |
| 5 | Listing editor has no AI assistance | High | Listing Editor |
| 6 | Custom metrics not auto-populated | Medium | Listing Editor |
| 7 | Landing pages are usually empty (no content fields populated) | Critical | Landing Page |
| 8 | No landing page preview in admin editor | Medium | Admin UX |
| 9 | Landing page doesn't track anonymous listing views | High | Analytics |
| 10 | Dynamic "Presented By" is hardcoded | Medium | Landing Page |
| 11 | No post-submission signup nudge | High | Conversion |
| 12 | No email capture for non-submitters | Medium | Conversion |
| 13 | Hardcoded contact info in multiple places | Medium | Maintenance |
| 14 | Sidebar "Browse Marketplace" goes to external URL without UTM | Medium | Attribution |
| 15 | Related deal cards link to signup instead of landing pages | Medium | Funnel |
| 16 | No deal context preserved through signup | High | Attribution |
| 17 | 5-step signup may be too long for landing page traffic | Medium | Conversion |
| 18 | Landing page → signup attribution gap | High | Analytics |
| 19 | No landing page conversion dashboard | Medium | Analytics |
| 20 | Click tracking not reliably persisted | Low | Analytics |

---

## 9. Architecture Diagram

```
                    ┌──────────────────────────┐
                    │   Deal Sources            │
                    │  (Fireflies, Valuation,   │
                    │   CAPTarget, Manual)       │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │   enrich-deal             │
                    │  (Gemini + Firecrawl +    │
                    │   LinkedIn + Reviews)      │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │   Marketplace Queue       │
                    │  (pushed_to_marketplace)   │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                  │
    ┌─────────▼─────┐  ┌──────▼────────┐  ┌─────▼──────────┐
    │ Anonymizer    │  │ [NEW]          │  │ generate-lead- │
    │ (basic text   │  │ generate-      │  │ memo           │
    │  replacement) │  │ listing-       │  │ (Claude AI     │
    │               │  │ content        │  │  full memo +   │
    └───────┬───────┘  │ (AI landing   │  │  anon teaser)  │
            │          │  page content) │  └────────────────┘
            │          └──────┬────────┘
            │                 │
            └────────┬────────┘
                     │
          ┌──────────▼───────────────┐
          │   ImprovedListingEditor   │
          │  (admin reviews/edits)    │
          │  [NEW: AI assist buttons] │
          │  [NEW: landing preview]   │
          └──────────┬───────────────┘
                     │
          ┌──────────▼───────────────┐
          │   publish-listing        │
          │  (quality validation)     │
          └──────────┬───────────────┘
                     │
          ┌──────────▼───────────────┐
          │   Public Landing Page    │
          │   /deals/:id             │
          │                          │
          │  ┌─────────────────────┐ │
          │  │ DealHero            │ │
          │  │ MetricsStrip        │ │
          │  │ ContentSections     │ │
          │  │ DealRequestForm ────┼─┼──→ connection_requests
          │  │ DealSidebar ────────┼─┼──→ Signup / Marketplace
          │  │ RelatedDeals ───────┼─┼──→ Other Landing Pages
          │  └─────────────────────┘ │
          └──────────────────────────┘
                     │
          ┌──────────▼───────────────┐
          │   Signup (5-step)        │
          │   [NEW: deal context]    │
          │   [NEW: fast-track]      │
          └──────────┬───────────────┘
                     │
          ┌──────────▼───────────────┐
          │   Pending Approval       │
          │   (NDA signing)          │
          └──────────┬───────────────┘
                     │
          ┌──────────▼───────────────┐
          │   Marketplace Access     │
          │   (full deal browsing)   │
          └──────────────────────────┘
```

---

*End of audit. Produced by automated codebase analysis on 2026-02-28.*
