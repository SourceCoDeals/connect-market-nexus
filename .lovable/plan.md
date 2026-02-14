

## Problem: Duplicate Empty Records Instead of Re-tagging Existing Deals

### What Went Wrong

When the edge function couldn't find exact title matches for 6 deals, instead of locating the existing records (which had enriched data -- descriptions, locations, etc.), it **created brand-new empty records**. This left you with:

- **6 duplicate empty listings** tagged as `gp_partners` (no description, no location, no revenue)
- **The original enriched versions** still sitting in "All Deals" tagged as `manual`

**Affected deals with duplicates:**

| Deal | Original (has data) | Duplicate (empty, gp_partners) |
|------|-------------------|-------------------------------|
| Advacned Window Inc | `91136b64` (manual, has description + location) | `ccf7d87c` (new, empty) |
| Auto Body Brothers | Not found in DB -- genuinely new | `707a8dce` (new, empty) |
| Brook Capital | Not found -- genuinely new | `078f9305` (new, empty) |
| Northern lights Heating & Cooling | Not found -- genuinely new | `f900cb7f` (new, empty) |
| Rhinelander Collision Center | Not found -- genuinely new | `4fbe9865` (new, empty) |
| SHORELINE AUTO BODY | Not found -- genuinely new | `1ab21ffe` (new, empty) |

### Fix Plan

**Step 1: Fix "Advacned Window Inc" (has existing data)**
- Delete the empty duplicate (`ccf7d87c`)
- Re-tag the original enriched record (`91136b64`) as `gp_partners` so it keeps its description, location, and all other data

**Step 2: Keep the 5 genuinely new deals**
- Auto Body Brothers, Brook Capital, Northern Lights Heating & Cooling, Rhinelander Collision Center, and SHORELINE AUTO BODY do not have pre-existing records with data -- they are legitimately new entries from the spreadsheet
- Update their status from `new` to `active` so they appear properly in GP Partners

**Step 3: Verify final count**
- Confirm exactly 42 deals in GP Partners
- Confirm no remaining duplicates

### Technical Details

- Use `fix-gp-tagging` edge function with `tagByIds` to re-tag the original Advacned Window record
- Delete the empty duplicate via direct SQL (through the edge function)
- Update status on the 5 new records from `new` to `active`
- Run a final verification query to confirm 42 unique GP Partners deals with no orphaned duplicates

