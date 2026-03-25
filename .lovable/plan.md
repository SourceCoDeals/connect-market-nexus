

# Add Contact Detail Drawer to List Detail Page

## Summary

Make every row in the list detail page clickable. Clicking opens a slide-out drawer on the right showing the contact's full details, call history, and a link to navigate to the associated deal.

## Changes

### File 1: New — `src/components/admin/lists/ContactMemberDrawer.tsx`

Create a new drawer component using the existing `Sheet` UI primitive. It receives a `ContactListMember` and displays:

- **Header**: Contact name, role, company
- **Contact Info section**: Email (mailto link), Phone (tel link)
- **Source & List Info**: Entity type badge, date added
- **Deal Owner**: Name if available
- **Call Activity section**: Total calls, last call date, last disposition
- **Actions footer**: 
  - "View Deal" button (navigates to `/admin/deals/${entity_id}`) — shown for deal-type entities
  - "Remove from List" button

The drawer will be ~480px wide (override the default `sm:max-w-sm` with `sm:max-w-md`).

### File 2: `src/pages/admin/ContactListDetailPage.tsx`

- Add state: `const [drawerMember, setDrawerMember] = useState<ContactListMember | null>(null)`
- Change the row click handler: instead of directly navigating to the deal page, set `drawerMember` to the clicked member (for ALL entity types, not just deal types)
- Render `<ContactMemberDrawer>` at the bottom of the page, passing `drawerMember`, `onClose`, `onRemove`, and `onNavigateToDeal`
- Keep the existing deal navigation as a button inside the drawer

### Technical Detail

```
Row click → setDrawerMember(member) → Sheet opens
  ├── Contact info (name, email, phone, company, role)
  ├── Call activity (from existing joined data on ContactListMember)
  ├── Deal owner info
  └── Actions: [View Deal] [Remove from List]
```

| File | Change |
|------|--------|
| `src/components/admin/lists/ContactMemberDrawer.tsx` | New drawer component |
| `src/pages/admin/ContactListDetailPage.tsx` | Wire drawer state, make all rows clickable |

