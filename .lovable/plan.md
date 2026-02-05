
# Comprehensive Listings Management Restructure

## Problem Statement

The current "Internal Drafts" tab only shows listings with images that have `is_internal_deal = true` (19 listings). The 56 remarketing deals (which have no images but rich AI-enriched data) are completely hidden from the admin listings management view.

The user wants a holistic overview showing:
1. **Marketplace** - Public-facing listings (62)
2. **Remarketing Deals** - Internal M&A research deals (56) with completely different card design

Additionally, the current card design has visual issues: badge soup, poor hierarchy, disconnected elements.

---

## Solution Architecture

### Tab Structure Redesign

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Listings Management                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐                                │
│  │ Marketplace 62  │  │ Research Deals 56│                               │
│  └─────────────────┘  └─────────────────┘                                │
│                                                                          │
│  [Marketplace Tab]                    [Research Deals Tab]               │
│  - Premium image cards                - Data-focused table/cards         │
│  - PublishListing actions             - Enrichment badges                │
│  - Marketplace visibility             - Quality scores                   │
│  - Buyer type restrictions            - Match buyer actions              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tab 1: Marketplace (Keep existing, improve design)
- Filter: `is_internal_deal = false` AND `image_url IS NOT NULL`
- **Improved Card Design** (hyper-premium, minimal)
- Publish/Unpublish workflow
- Status tags, buyer visibility controls

### Tab 2: Research Deals (NEW - Remarketing)
- Filter: `is_internal_deal = true` AND `(image_url IS NULL OR image_url = '')`
- **Completely different card component** optimized for data-dense remarketing deals
- Key fields: Company name, Executive summary, Revenue/EBITDA, Geography, Quality Score, Enrichment status
- Actions: View Deal, Match Buyers, Enrich, Add to Universe

---

## Premium Card Design System

### Marketplace Card (Redesigned)

Current issues being fixed:
- Remove Status Tag dropdown from card body (move to hover/click action)
- Clean badge hierarchy - max 3 visible, overflow as count
- Refined financial display with subtle separators
- Remove disconnected "JUST LISTED" tag

```text
┌────────────────────────────────────────┐
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │    [Image - 16:9 aspect]         │  │
│  │                                  │  │
│  │   ◉ Active     Published ↗       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Independent Wealth Advisory Firm      │ ← Title: text-base font-semibold
│  Brook Capital                         │ ← Company: text-xs text-muted
│                                        │
│  ┌──────┐ ┌───────────────┐ ┌───────┐  │
│  │ADD-ON│ │Finance & Insur│ │Midwest│  │ ← Subtle pill badges
│  └──────┘ └───────────────┘ └───────┘  │
│                                        │
│  ─────────────────────────────────────  │ ← Subtle divider
│                                        │
│  $1.6M Revenue    ·    $500K EBITDA    │ ← Inline metrics, no boxes
│                                        │
│  ─────────────────────────────────────  │
│                                        │
│  Jan 26 · Updated Feb 5                │ ← Micro timestamp
│                                        │
│  ┌──────────────────────────────────┐  │
│  │        Edit        │  ··· │      │  │ ← Clean action bar
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### Research Deal Card (NEW Component)

Optimized for data-dense remarketing deals without images:

```text
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │
│ │ ⭐ PRIORITY   │ ✨ Enriched  │ 75 │ │ ← Status row + Quality Score
│ └────────────────────────────────────┘ │
│                                        │
│ B & D Threefold Collision Centers      │ ← Company name (primary)
│                                        │
│ Gold Class® collision repair           │ ← Executive summary (2 lines)
│ business in Oklahoma with ICAR...      │
│                                        │
│ ┌────────┐ ┌────────┐ ┌───────────────┐│
│ │Collision│ │ OK     │ │★ 5.0 (1 rev) ││ ← Industry, State, Google
│ └────────┘ └────────┘ └───────────────┘│
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ $9.0M Rev  ·  $900K EBITDA  ·  30% Mrg │ ← Financials inline
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ threefoldcollision.com ↗               │ ← Website link
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ ┌───────────┐ ┌───────────┐ ┌───────┐ │
│ │View Deal  │ │Match Buyers│ │  ···  │ │ ← Actions
│ └───────────┘ └───────────┘ └───────┘ │
└────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Update Query Hook

**File: `src/hooks/admin/listings/use-listings-by-type.ts`**

Change `ListingType` to: `'marketplace' | 'research'`

Update filter logic:
- `marketplace`: `is_internal_deal = false` AND `image_url IS NOT NULL`
- `research`: `is_internal_deal = true` AND `(image_url IS NULL OR image_url = '')`

Add additional fields to select for research deals: `executive_summary`, `service_mix`, `geographic_states`, `enriched_at`, `deal_quality_score`, `linkedin_employee_count`, etc.

### 2. Create Research Deal Card Component

**File: `src/components/admin/ResearchDealCard.tsx`**

Premium, data-focused card for remarketing deals:
- No image section (uses icon placeholder)
- Prominent company name display
- Executive summary preview (2 lines, truncated)
- Quality score badge (color-coded 80+/60+/40+)
- Enrichment status indicator
- Geography badges
- Google rating & reviews
- LinkedIn employee data
- Financial metrics (inline, minimal)
- Action buttons: View Deal, Match Buyers

### 3. Redesign Marketplace Card

**File: `src/components/admin/AdminListingCard.tsx`**

Refinements for premium aesthetic:
- Remove inline Status Tag Switcher (move to dropdown menu)
- Clean up badge hierarchy (max 3, with overflow count)
- Inline financial metrics (no box containers)
- Refined typography scale
- Subtle dividers between sections
- Cleaner action bar layout

### 4. Update Tab Content Component

**File: `src/components/admin/ListingsTabContent.tsx`**

- Accept new `type` values: `'marketplace' | 'research'`
- Conditionally render `AdminListingCard` or `ResearchDealCard` based on type
- Update empty state messaging per tab

### 5. Update Tab Navigation

**File: `src/components/admin/ListingsManagementTabs.tsx`**

- Rename "Internal Drafts" → "Research Deals"
- Update icon from `FileEdit` to `Target` or `Building2`
- Update count query for new filter logic

### 6. Update Count Query

**File: `src/hooks/admin/listings/use-listings-by-type.ts`**

```typescript
// Research deals count (no image, internal)
supabase
  .from('listings')
  .select('id', { count: 'exact', head: true })
  .is('deleted_at', null)
  .or('image_url.is.null,image_url.eq.')
  .eq('is_internal_deal', true)
```

---

## Design Specifications

### Color System for Score Badges
- 80+: `bg-emerald-500/10 text-emerald-700`
- 60-79: `bg-blue-500/10 text-blue-700`
- 40-59: `bg-amber-500/10 text-amber-700`
- <40: `bg-red-500/10 text-red-700`

### Typography Scale
- Card Title: `text-[15px] font-semibold leading-tight text-foreground`
- Company/Subtitle: `text-xs font-medium text-muted-foreground`
- Summary Text: `text-[13px] leading-relaxed text-muted-foreground line-clamp-2`
- Metrics: `text-sm font-medium text-foreground`
- Micro Labels: `text-[10px] uppercase tracking-wide text-muted-foreground/70`

### Spacing
- Card Padding: `p-5`
- Section Gap: `gap-3`
- Badge Gap: `gap-1.5`
- Metric Separator: `·` (middle dot with `mx-2`)

### Transitions
- Card hover: `transition-all duration-200 hover:shadow-md hover:border-border`
- Button hover: `transition-colors duration-100`

---

## Files to Create/Modify

### New Files
1. `src/components/admin/ResearchDealCard.tsx` - New premium card for remarketing deals

### Modified Files
1. `src/hooks/admin/listings/use-listings-by-type.ts` - Update types and queries
2. `src/components/admin/ListingsManagementTabs.tsx` - Rename tab, update icon
3. `src/components/admin/ListingsTabContent.tsx` - Conditional card rendering
4. `src/components/admin/AdminListingCard.tsx` - Premium design refinements

---

## Expected Outcome

| Tab | Before | After |
|-----|--------|-------|
| Marketplace | 62 listings (unchanged) | 62 listings (premium design) |
| Internal Drafts | 19 listings with images | → Renamed to "Research Deals" |
| Research Deals | N/A (hidden) | 56 remarketing deals |

Total visibility: 81 → 118 listings (+37 remarketing deals now visible)

---

## Quality Score Display Logic

For research deals, display quality score prominently:
- If `deal_total_score` exists: Show as primary score
- Fallback to `deal_quality_score` if available
- If no score: Show "—" or "Not Scored" badge
- Priority deals (`is_priority_target = true`): Add star indicator
