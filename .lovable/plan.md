

## Navigation Sidebar Overhaul

Inspired by the BuildBetter reference image: clean top-level items, logically grouped collapsible sections, no misleading divider labels.

### Current Problems

1. **"User-Facing" divider includes only Marketplace but excludes Remarketing** -- yet Remarketing IS under "Operations" which is confusing since it's purely internal
2. **Deals section is too thin** (2 items) while Buyers and Remarketing overlap (Deal Sourcing, Document Tracking are deal-related but sit under Buyers)
3. **Lists is a lonely single-item section** that wastes space
4. **"Remarketing Deals" duplicates "Active Deals"** (both link to `/admin/deals`)
5. Too many divider labels ("User-Facing", "Operations", "Insights", "System") add visual noise without clarity

### New Structure

Remove all divider labels. Use clean collapsible section headers (like BuildBetter). Regroup by actual function:

```text
[Search]                     -- stays

Dashboard                    -- standalone
Messages              (badge)-- standalone  
Daily Tasks                  -- standalone

v MARKETPLACE                -- user-facing platform
    View Marketplace    (ext)
    Manage Listings
    Marketplace Queue
    Connection Requests (badge)
    Marketplace Users   (badge)

v DEALS                      -- deal lifecycle
    Active Deals
    Pipeline
    Deal Sourcing       (badge)
    Document Tracking
    Lists

v BUYERS                     -- buyer CRM
    All Buyers
    Buyer Universes
    Buyer Contacts

v REMARKETING                -- internal lead gen
    Overview
    CapTarget Deals
    GP Partner Deals
    Valuation Leads
    Referral Partners
    Owner/Seller Leads  (badge)

v ANALYTICS                  -- insights
    Website Analytics
    Remarketing Analytics
    Transcript Analytics

v SETTINGS                   -- system config
    Internal Team
    Notifications
    Security & MFA
    Form Monitoring
    [admin-only items...]

[+ New Buyer Universe]       -- stays
[User profile]               -- stays
```

### Key Changes

1. **Remove all divider labels** ("User-Facing", "Operations", etc.) -- the section names themselves are self-explanatory
2. **Move "Deal Sourcing" and "Document Tracking" from Buyers to Deals** -- they're deal-related activities
3. **Merge "Lists" into Deals** -- lists are used in deal context
4. **Remove duplicate "Remarketing Deals"** link (identical to Active Deals)
5. **Rename "Admin" section to "Settings"** -- more intuitive, matches the gear icon
6. **Clean visual style** -- slightly more spacing between sections, subtle separator lines only between major groups (no labels)

### File to Change

| File | Change |
|------|--------|
| `src/components/admin/UnifiedAdminSidebar.tsx` | Reorganize `sections` array: move items between groups, remove divider labels from `groupDividers`, remove duplicate Remarketing Deals link, rename Admin to Settings. Add thin separator lines between sections without text labels. |

### What stays the same

- All routes and pages remain unchanged
- All badge counts stay wired up
- Collapsed/expanded state logic unchanged
- User profile menu unchanged
- Search unchanged
- SidebarLink component unchanged
- All permission gating (canAccessSettings) stays

