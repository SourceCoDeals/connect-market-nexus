
Deep-dive audit complete. You’re right: it is not working as intended, and the popup was never implemented.

## What happened in your latest run (Saks / listing `b0bf5382-1e13-4082-a24a-ef38af209437`)

1) **Search execution succeeded**
- `seed-buyers` returned HTTP 200 and job completed.
- `buyer_search_jobs` latest row: `completed`, `buyers_found=10`, `buyers_inserted=1`, `buyers_updated=9`.

2) **But the audit log write failed**
- Edge log at `2026-03-08T20:20:42Z`:  
  `Batch seed log insert failed (non-fatal): duplicate key value violates unique constraint "idx_buyer_seed_log_buyer_deal"`.

3) **That failure makes External tab empty**
- `score-deal-buyers` explicitly drops AI-seeded buyers with no seed-log row:
  - `supabase/functions/score-deal-buyers/index.ts` lines 203–209.
- Current DB state for this listing:
  - `buyer_seed_log` rows = **0**
  - Cached scored results source mix = **31 scored + 19 marketplace + 0 ai_seeded**
- Result: External tab has nothing even though AI search looked successful.

## Root cause chain

### A) Duplicate AI results are being produced/kept
Evidence:
- `seed-buyers` log: `JSON repair attempt 5 (regex) recovered 10 buyer objects`.
- `buyer_seed_cache.buyer_ids` for this run has **10 total IDs but only 7 distinct** (repeated IDs like Envirocon/Weeks Marine).
- Browser console warning confirms duplicate React keys:
  - “Encountered two children with the same key … `9b2ca5c9-...`”
  - Stack points to `SeedResultsSummary` in `RecommendedBuyersTab`.

Why this matters:
- Duplicate buyer IDs in `seedLogEntries` violate unique index `(remarketing_buyer_id, source_deal_id)`.
- Single batch insert fails entirely, leaving **zero** logs.

### B) Seed log failure is treated as non-fatal
In `supabase/functions/seed-buyers/index.ts` lines 994–997:
- Insert error is logged but function still returns success and marks job completed.
- So UI says “done” while downstream scoring lacks required seed-log rows.

### C) No popup summary exists in code
In `src/components/admin/deals/buyer-introductions/tabs/RecommendedBuyersTab.tsx`:
- `handleSeedBuyers` only does toasts + inline state (`seedResults`) lines 466–487.
- Inline collapsible `SeedResultsSummary` is rendered at line 750.
- There is **no** search-completion dialog component/state for this flow.
- Session replay confirms a toast appeared (“AI seeded 10 buyers...”), not a modal popup.

## Important clarification

The previous migration blockers are now resolved in DB:
- `buyer_seed_log` has `buyer_profile` + `verification_status`.
- `buyers_website_required` now exempts `buyer_type='private_equity'`.

So the **current blocker is no longer migrations**; it is the duplicate-result -> seed-log insert failure path.

## Technical details section

- **UI file:** `src/components/admin/deals/buyer-introductions/tabs/RecommendedBuyersTab.tsx`
  - Uses toasts, not a popup summary dialog.
  - Renders seed results list keyed by `buyer_id`, which exposes duplicate-key warnings if API returns duplicate IDs.
- **Seed function:** `supabase/functions/seed-buyers/index.ts`
  - Can ingest duplicate candidates after JSON-repair fallback.
  - Appends duplicate `buyerId` entries to `seedLogEntries` and `buyer_seed_cache.buyer_ids`.
  - Batch insert into `buyer_seed_log` then fails on unique index.
- **Scoring function:** `supabase/functions/score-deal-buyers/index.ts`
  - Filters out `ai_seeded` buyers that lack seed-log rows for the active deal.
  - Hence External tab empties when seed log write fails.

## If you want fixes next, this is the correct fix order

1. De-duplicate candidates within `seed-buyers` before writing `results`, `seedLogEntries`, and `buyer_seed_cache`.
2. Make seed-log insert resilient (`upsert` on conflict or per-row conflict handling), not all-or-nothing failure.
3. Make seed-log failure visible to UI/job status (not silent success).
4. Add the requested completion popup dialog for AI search results.
