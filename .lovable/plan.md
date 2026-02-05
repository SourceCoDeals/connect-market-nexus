
## What I found (deep dive)

### 1) There is only one “deal/listing storage” table right now
Both the public marketplace listings and internal remarketing “research deals” live in the same table:

- `public.listings` (single source of truth for “deals” in this app)
- Remarketing associates listings via:
  - `remarketing_universe_deals.listing_id → listings.id`
  - `remarketing_scores.listing_id → listings.id`

So, today, remarketing is not “separate storage”; it is a layer of relationships + UI on top of the same `listings` rows.

### 2) Marketplace visibility is controlled (in code) by `is_internal_deal = false`
Marketplace fetches (both implementations) include:
- `status = 'active'`
- `deleted_at is null`
- `is_internal_deal = false`

This is correct and is the intended isolation mechanism.

### 3) In the current DB state, the marketplace is empty because there are **zero** active, non-deleted listings with `is_internal_deal = false`
From the database (Test env):
- `marketplace_visible` (active + not deleted + `is_internal_deal=false`) = **0**
- `internal_visible` (active + not deleted + `is_internal_deal=true`) = **80**

That matches what you’re seeing: “no listings are currently showing on the marketplace”.

### 4) “Independent Wealth Advisory Firm” is currently marked internal
The listing you explicitly want visible first:
- `Independent Wealth Advisory Firm` (`c0718940-...`) is:
  - `status='active'`
  - `deleted_at is null`
  - `is_internal_deal=true`
  - has existing marketplace-related data:
    - `listing_analytics` rows: **55**
    - `connection_requests`: **5**

So the marketplace isn’t “broken”; it’s filtering correctly. The data classification is wrong.

### 5) The single biggest root cause: **database default for `is_internal_deal` is currently `true`**
Schema shows:
- `listings.is_internal_deal` is nullable
- default is **true**

That means: any insert into `listings` that does **not** explicitly set `is_internal_deal` will silently become internal-only.

### 6) Admin listing creation path can accidentally omit `is_internal_deal`
Your admin “robust listing creation” hook (`useRobustListingCreation`) builds a `DatabaseListingInsert` payload that **does not include `is_internal_deal`** at all.

Given the DB default is currently `true`, “admin-created marketplace listings” can be accidentally created as internal deals. This is consistent with “marketplace suddenly has nothing.”

### 7) Additional risk: remarketing tooling can accidentally “convert” marketplace listings into internal listings
You have a migration that adds triggers to force `is_internal_deal=true` whenever:
- a listing is linked to a universe (`remarketing_universe_deals` insert)
- a listing receives a score (`remarketing_scores` insert)

At the same time, the remarketing UI has flows that can operate on arbitrary `listings` rows (it does not strictly filter to internal-only listings). If a marketplace listing gets linked/scored, the trigger can flip it to internal → it disappears from marketplace.

Even if this wasn’t the primary cause of today’s outage, it is a major “integrity foot-gun” in the current architecture.

---

## Exact cause of “we accidentally published remarketing deals publicly”
There are two different incidents that can both be described as “remarketing/marketplace integrity broke”:

### A) Historical “leak” (remarketing deals appear publicly)
This would happen if any remarketing flow inserted into `public.listings` without setting `is_internal_deal=true` (or if the flag was missing at the time). That would create low-quality “research/import” rows that look public.

You have since added:
- UI-side explicit `is_internal_deal: true` in remarketing imports/creation
- DB triggers that force internal when a listing becomes part of remarketing

So this class of leak should be preventable going forward, but it was possible earlier.

### B) Current “outage” (no marketplace listings show at all)
This is happening now in Test because:
- `is_internal_deal` default is `true`
- admin listing creation can omit the field
- and/or marketplace listings were flipped internal by remarketing linking/scoring triggers

Result: marketplace filters correctly and returns 0.

---

## Requirements you stated (translated to enforceable rules)

1) Remarketing deals must never appear publicly.
2) Only the “admin listings publish flow” should be able to make a listing public.
3) Data integrity must be protected at the database level (not just UI).
4) Preserve all existing marketplace relationships:
   - connection requests
   - pipeline/deals workflow
   - saves/views/analytics
5) Restore marketplace visibility (starting with “Independent Wealth Advisory Firm”).

---

## Recommended course of action (exhaustive), phased for safety

### Phase 0 — Confirm whether Live is also impacted (5 minutes, no code changes)
Because Test and Live can diverge, we should confirm Live’s counts before applying any classification changes:
- Count active marketplace-visible listings in Live
- Identify whether “Independent Wealth Advisory Firm” is internal in Live too

If Live still shows leaked remarketing deals, we’ll fix Live classification first, then publish code.

Deliverable:
- A small “Live health checklist” query set you run in Cloud View (Live selected).

---

### Phase 1 — Immediate restore: make marketplace show the right listings again (no refactor yet)
Goal: restore marketplace listings without deleting anything, preserving IDs and all related records.

#### 1.1 Fix the schema default and nullability for `is_internal_deal`
Change `listings.is_internal_deal` to:
- `NOT NULL`
- default `false`

Why:
- “Public marketplace” should be the safe default for admin listing creation only if we *also* enforce publish rules (next step).
- But right now default true is causing accidental internalization and an empty marketplace.

#### 1.2 Backfill the correct values for existing rows
We need a deterministic classifier.

Safe rule:
- If a listing is in remarketing tables, it is internal:
  - exists in `remarketing_universe_deals` (status active) OR exists in `remarketing_scores`
- Otherwise it is a marketplace listing candidate (NOT automatically public; see publish protection in Phase 2)

Because you also have internal deals that might not yet be linked/scored (example: internal-only imports before assignment), we should NOT blindly set “not linked” → public.

So instead we do a two-step backfill:

Step A (guaranteed):
- Force internal for any listing that is linked/scored.

Step B (controlled restore):
- For marketplace restore, we produce a candidate list of listings that:
  - have marketplace engagement (connection_requests, listing_analytics, saved_listings)
  - and are not linked/scored in remarketing
- You approve that list (or we auto-apply with thresholds) and we flip them public.

This avoids accidentally publishing internal research deals that simply haven’t been put into a universe yet.

Deliverables:
- A “candidate restoration” SQL that outputs rows to review
- A “restore marketplace visibility” SQL update you run after review

#### 1.3 Explicitly restore “Independent Wealth Advisory Firm”
Since you explicitly named it as should be visible:
- Set `is_internal_deal=false` for that listing (and later mark as published in Phase 2)

This will immediately bring it back in marketplace without breaking analytics/requests.

---

### Phase 2 — Hard protection: introduce a protected “publish” mechanism (prevents future leaks)
Right now, “publishing” is just “insert/update with `is_internal_deal=false`”, which is too easy to do accidentally.

#### 2.1 Add explicit publish fields on `listings`
Add:
- `published_at timestamptz null`
- `published_by_admin_id uuid null` (FK to profiles)

Marketplace definition becomes:
- `status='active'`
- `deleted_at is null`
- `is_internal_deal=false`
- `published_at is not null`
- optionally: `published_by_admin_id is not null`

#### 2.2 Add a DB constraint so you cannot “accidentally publish”
Enforce at DB level:
- If `is_internal_deal=false` then `published_at is not null`

This alone prevents “random inserts” from becoming public unless publish fields are set intentionally.

#### 2.3 Create a dedicated Edge Function: `publish-listing`
- Auth required
- Must verify admin role
- Validates listing meets minimum marketplace quality requirements (title, category, description length, location, etc.)
- Updates:
  - `is_internal_deal=false`
  - `published_at=now()`
  - `published_by_admin_id=auth.uid()`
  - (optionally) `status='active'`

This becomes the only supported way to publish.

#### 2.4 Update Admin UI (/admin/listings) to use the publish function
Change the admin flow to:
- Create listing as a “draft” (internal or status=inactive)
- Publish only when an admin clicks “Publish”

This removes accidental publication and gives a deliberate control point.

#### 2.5 (Optional but recommended) Create `unpublish-listing` function
Allows reverting (sets `is_internal_deal=true`, clears published fields) without deleting.
Preserves pipeline and analytics.

---

### Phase 3 — Fix remarketing UX/data pathways to avoid corrupting marketplace rows
Even if we don’t build separate storage yet, we should remove paths that can mutate marketplace rows unintentionally.

#### 3.1 Stop remarketing UI from operating on public listings directly
Instead of “Add existing marketplace listing to universe”:
- Option 1 (simple): only allow selecting listings where `is_internal_deal=true`
- Option 2 (best): allow selecting any listing, but when you add it to remarketing:
  - create an internal “snapshot copy” listing (new row with `is_internal_deal=true`)
  - store `source_listing_id` on the internal copy
  - link the internal copy to the universe

This prevents remarketing from flipping real marketplace deals internal and preserves public deal continuity.

#### 3.2 Review the trigger strategy
If remarketing can ever reference marketplace listings, then the “force internal” triggers are too aggressive.
With snapshot-copy design, triggers become safe again because they only touch internal copies.

---

### Phase 4 — True separation (what you asked for): create separate remarketing deal storage
This is the long-term architectural fix.

#### 4.1 Create `remarketing_deals` table (separate from marketplace)
Store all remarketing-only fields there.
Include:
- `id`
- `universe_id` (optional)
- `created_at`
- `created_by_admin_id`
- core firm fields (name, website, location, revenue, ebitda, notes, enrichment fields)

#### 4.2 Update remarketing UI and edge functions to use `remarketing_deals`
- All remarketing pages query `remarketing_deals`, not `listings`
- Enrichment worker(s) get upgraded to support remarketing_deals
- Scoring tables reference remarketing_deals instead of listings (or store both during transition)

#### 4.3 Promotion pipeline: “Publish to marketplace”
A deliberate action that:
- creates a new row in `public.listings` from a remarketing_deal
- links back via `source_remarketing_deal_id`
- runs `publish-listing` to make it public

This eliminates cross-contamination permanently.

Risk/complexity note:
- This is a significant migration because many existing systems assume `listing_id` (connection_requests, saved_listings, listing_analytics, pipeline references).
- We should NOT change marketplace IDs. We only add mapping fields and create new ones for promoted deals.

---

## Implementation checklist (what I will do once you approve)

### Database migrations (safe + reversible)
1) Fix `is_internal_deal` column:
   - set default to false
   - set NOT NULL
2) Add publishing columns:
   - `published_at`
   - `published_by_admin_id`
3) Add DB constraint:
   - `is_internal_deal=false → published_at is not null`
4) Add “restoration scripts”:
   - force internal where remarketing-linked/scored
   - generate candidate list of marketplace listings to restore
   - flip approved candidates to public + set published fields

### Frontend
5) Fix admin listing creation so it never relies on DB defaults:
   - always sets `is_internal_deal` explicitly
6) Add “Publish” button and wire it to the edge function
7) Modify remarketing “add existing listing” behavior:
   - restrict to internal listings OR snapshot-copy approach (recommended)

### Edge Functions
8) Create `publish-listing` and (optional) `unpublish-listing`
9) Add logging + guardrails (admin-only)

### Verification (end-to-end)
10) Confirm in Test:
   - Marketplace shows intended listings (starting with Independent Wealth Advisory Firm)
   - Remarketing deals do not appear publicly
   - Connection requests/pipeline still work for restored listings
11) Repeat the same verification on Live before/after publish

---

## Critical user decisions needed (so we don’t guess and accidentally publish internal deals)
1) Do you want remarketing to be able to “reference” a marketplace listing, or should it always create an internal copy?
   - Strong recommendation: internal copy (snapshot) so the systems are isolated.
2) Do you want internal-only deals (not linked to universes yet) to ever be visible publicly?
   - I recommend “No”—only publish through the explicit publish flow.

If you want, I can continue in a new request to (a) draft the exact SQL for the restoration candidate list for Live, and (b) produce the exact migration + edge-function changes in implementation mode.
