
# Listings Management Redesign: Dual-Tab Interface with Premium Design

## Overview

Restructure the `/admin/listings` page into a two-tab interface that clearly separates:
1. **Marketplace Listings** - Public-facing deals visible to buyers
2. **Internal Deals** - Remarketing/research deals (admin-only, never public)

This creates complete clarity on deal classification while maintaining premium, investment-grade design quality.

---

## Current State Analysis

| Category | Count | Description |
|----------|-------|-------------|
| Marketplace (published) | 62 | Listings with images, `is_internal_deal = false` |
| Internal Drafts | 19 | Listings with images, `is_internal_deal = true` (not linked to remarketing) |
| Remarketing Deals | 56 | Listings without images, imported via CSV/enrichment tools |

Current admin listings query shows **only listings with images** (81 total), which is correct for the marketplace management view. Remarketing deals (56) are already hidden from this view.

---

## Solution Architecture

### New Tab Structure

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Listings Management                                                    │
│  Manage and monitor marketplace listings with enterprise-grade tools   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────┐  ┌───────────────────┐                          │
│  │  Marketplace (62) │  │  Drafts (19)      │                          │
│  │  ▼ Active         │  └───────────────────┘                          │
│  └───────────────────┘                                                 │
│                                                                        │
│  [Search] [Filters] [Grid/Table] [+ Add New Listing]                   │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Listing Cards Grid (marketplace tab) or Drafts Grid            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Tab 1: Marketplace (Default)
- Shows listings where `is_internal_deal = false` AND has image
- These are the public-facing deals
- Includes "Published" and "Draft" status badges
- Actions: Edit, Publish/Unpublish, Activate/Deactivate, Delete

### Tab 2: Internal Drafts
- Shows listings where `is_internal_deal = true` AND has image
- These are admin-created listings not yet published
- Action to "Publish to Marketplace" moves listing to Tab 1
- Separated from remarketing deals (remarketing has its own page)

---

## Technical Implementation

### 1. Create New Query Hooks for Each Tab

**File: `src/hooks/admin/listings/use-marketplace-listings-query.ts`**
```typescript
// Fetches published marketplace listings
// Filter: is_internal_deal = false AND image_url IS NOT NULL
```

**File: `src/hooks/admin/listings/use-draft-listings-query.ts`**
```typescript
// Fetches internal draft listings (with images, not yet published)
// Filter: is_internal_deal = true AND image_url IS NOT NULL
```

### 2. Create Tabbed Container Component

**File: `src/components/admin/ListingsManagementTabs.tsx`**
```typescript
// Premium tab interface with:
// - Segment control style tabs (Linear/Stripe aesthetic)
// - Count badges on each tab
// - Smooth transitions between tabs
// - Shared search and filters state
```

### 3. Refactor EnhancedAdminListings

**File: `src/components/admin/EnhancedAdminListings.tsx`**
- Accept `dealType` prop: `'marketplace' | 'drafts'`
- Filter listings based on deal type
- Adjust available actions per deal type

### 4. Premium Tab Design

Following the `editor-design-system.ts` patterns:

**Tab Container**
- Background: `bg-slate-50/40` (subtle card bg)
- Border: `border border-border/40 rounded-xl`
- Shadow: `shadow-sm`

**Tab Triggers**
- Inactive: `text-muted-foreground/70 hover:text-foreground`
- Active: `bg-white shadow-sm text-foreground font-medium`
- Count badge: `bg-foreground/5 text-foreground/70 text-xs`

**Visual Hierarchy**
- Title: `text-2xl font-light tracking-tight` (Linear style)
- Subtitle: `text-muted-foreground text-sm`
- Stats pills: Rounded, subtle backgrounds, micro text

---

## Component Structure

```text
AdminListings.tsx (page)
└── ListingsManagementTabs.tsx (new - container)
    ├── Header Section
    │   ├── Title & Description
    │   └── Primary Action (+ Add New Listing)
    ├── Premium Tab Navigation
    │   ├── Marketplace Tab (count: 62)
    │   └── Drafts Tab (count: 19)
    └── Tab Content
        ├── [shared] Search & Filters Bar
        ├── [shared] Bulk Actions (when items selected)
        └── ListingsGrid.tsx (extracted from EnhancedAdminListings)
            └── AdminListingCard.tsx
```

---

## Design Specifications

### Premium Tab Navigation

```css
/* Tab List Container */
.tab-list {
  display: inline-flex;
  padding: 4px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  gap: 4px;
}

/* Tab Trigger */
.tab-trigger {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 150ms ease;
}

/* Active Tab */
.tab-trigger[data-state="active"] {
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  color: #0f172a;
}

/* Count Badge */
.tab-count {
  margin-left: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(0,0,0,0.05);
  border-radius: 6px;
}
```

### Status Indicators on Cards

**Marketplace Tab Cards:**
- Published badge: `bg-emerald-500/10 text-emerald-600 border-emerald-500/20`
- Active status: Green dot indicator
- Archived: Muted styling with "Archived" label

**Drafts Tab Cards:**
- Draft badge: `bg-amber-500/10 text-amber-600 border-amber-500/20`
- "Ready to Publish" indicator when listing meets quality requirements
- "Needs Attention" indicator if missing required fields

---

## Files to Create/Modify

### New Files
1. `src/components/admin/ListingsManagementTabs.tsx` - Main tabbed container
2. `src/components/admin/ListingsGrid.tsx` - Extracted grid component
3. `src/hooks/admin/listings/use-listings-by-type.ts` - Combined query hook

### Modified Files
1. `src/components/admin/EnhancedAdminListings.tsx` - Integrate with tabs
2. `src/components/admin/AdminListingCard.tsx` - Add draft-specific actions
3. `src/hooks/admin/listings/use-listings-query.ts` - Add type filter parameter

---

## Data Flow

```text
useListingsByType(type: 'marketplace' | 'drafts')
    │
    ├── marketplace: 
    │   SELECT * FROM listings 
    │   WHERE is_internal_deal = false 
    │   AND image_url IS NOT NULL
    │   AND deleted_at IS NULL
    │
    └── drafts:
        SELECT * FROM listings 
        WHERE is_internal_deal = true 
        AND image_url IS NOT NULL
        AND deleted_at IS NULL
```

---

## User Experience

### Marketplace Tab (Default)
- Shows all published listings (62 total)
- Status filters: Active (18), Archived (40), Inactive (4)
- Actions: Edit, Unpublish, Archive, Delete

### Drafts Tab
- Shows admin-created listings not yet published (19 total)
- Prominent "Publish to Marketplace" action
- Actions: Edit, Publish, Delete
- Visual indicator for "ready to publish" vs "needs attention"

### Cross-Tab Actions
- Publishing a draft moves it to Marketplace tab (automatic transition)
- Unpublishing a marketplace listing moves it to Drafts tab

---

## Empty States

**Marketplace Tab (empty)**
```text
┌─────────────────────────────────────┐
│        📋 No Marketplace Listings   │
│                                     │
│  Publish your first listing from    │
│  the Drafts tab, or create a new    │
│  listing to get started.            │
│                                     │
│        [+ Create Listing]           │
└─────────────────────────────────────┘
```

**Drafts Tab (empty)**
```text
┌─────────────────────────────────────┐
│        ✅ All Caught Up             │
│                                     │
│  All your listings have been        │
│  published to the marketplace.      │
│                                     │
│        [+ Create New Listing]       │
└─────────────────────────────────────┘
```

---

## Implementation Order

1. **Create `use-listings-by-type.ts` hook** - Add type filtering to existing query
2. **Create `ListingsGrid.tsx`** - Extract grid rendering from EnhancedAdminListings
3. **Create `ListingsManagementTabs.tsx`** - Premium tabbed container
4. **Update `EnhancedAdminListings.tsx`** - Use new structure
5. **Enhance `AdminListingCard.tsx`** - Context-aware actions per tab
6. **Test end-to-end** - Verify counts, transitions, and publish/unpublish flow
