

## Problem

The Buyers/Owners separation exists in the code but uses a subtle pill-button switcher (`UserViewSwitcher`) that can be easily overlooked. The user wants these two user types to be **clearly separated** with a more prominent, structured UI.

## Solution: Promote to First-Class Tabs

Replace the current pill-button `UserViewSwitcher` with proper top-level tabs integrated into the page header, making Buyers and Owners unmissable.

### Layout

```text
+----------------------------------------------------------+
| Users                                                     |
| Manage registrations, approvals, and leads               |
|                                                           |
| [Users]  [Firm Agreements]           (existing nav tabs)  |
|----------------------------------------------------------|
|                                                           |
| [ Buyers (142) ]  [ Owners (8) ]     (primary tabs)      |
|                                                           |
| When Buyers selected:                                     |
|   [ Marketplace | Non-Marketplace ]  (secondary pills)    |
|   + EnhancedUserManagement filters                        |
|   + UsersTable / NonMarketplaceUsersTable                 |
|                                                           |
| When Owners selected:                                     |
|   + OwnerLeadsStats                                       |
|   + OwnerLeadsFilters                                     |
|   + OwnerLeadsTableContent                                |
+----------------------------------------------------------+
```

### Changes

| File | Change |
|------|--------|
| `src/components/admin/UserViewSwitcher.tsx` | Restyle the primary Buyers/Owners toggle to use full-width underline-style tabs (matching the Users/Firm Agreements pattern above) instead of subtle muted pills. Keep the secondary Marketplace/Non-Marketplace as smaller pills below. |

This is a styling-only change to the existing `UserViewSwitcher` component -- making the primary toggle use larger, underlined tab buttons that match the existing page tab pattern. No logic changes needed; all data fetching and view switching already works correctly.

### Technical Details

- Replace the `bg-muted/50 p-1 rounded-lg` container for the primary toggle with an underline-tab style matching the `TabsList` pattern already used in the header (line 180 of `AdminUsers.tsx`)
- Use `border-b-2 border-foreground` for active state, `border-transparent` for inactive
- Increase font size and padding for prominence
- Keep the secondary marketplace/non-marketplace toggle as-is (smaller pills)
- No changes to data hooks, queries, or component mounting logic -- everything already works

