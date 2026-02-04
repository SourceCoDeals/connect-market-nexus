
# Make Owner Leads Table Sortable with "Contacted Owner" Checkbox

## Overview
Add sorting functionality to every column in the Owner Leads table and introduce a new "Contacted Owner" checkbox column that persists to the database.

## Changes Required

### 1. Database Migration
Add a `contacted_owner` boolean column to the `inbound_leads` table:

```sql
ALTER TABLE public.inbound_leads 
ADD COLUMN IF NOT EXISTS contacted_owner BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.inbound_leads.contacted_owner IS 
  'Tracks whether an admin has gotten in contact with the owner';
```

### 2. Update TypeScript Types
Modify `src/hooks/admin/use-owner-leads.ts` to include the new field:

```typescript
export interface OwnerLead {
  // ... existing fields
  contacted_owner: boolean;
}
```

Add a new mutation hook for updating the contacted status:

```typescript
export function useUpdateOwnerLeadContacted() {
  // Similar pattern to useUpdateOwnerLeadStatus
}
```

### 3. Refactor OwnerLeadsTableContent Component
Update `src/components/admin/OwnerLeadsTableContent.tsx`:

**Add sorting state and logic:**
- Define column types: `contact`, `company`, `revenue`, `timeline`, `status`, `date`, `contacted`
- Add sort state management
- Create `SortableHeader` component with arrow indicators

**Add new "Contacted" column:**
- Position as the first data column (after any selection checkboxes)
- Render a Checkbox component
- Wire up `onCheckedChange` to update database

**Updated columns (in order):**
1. Contacted (new checkbox column)
2. Contact - sortable by name
3. Company - sortable alphabetically  
4. Revenue - sortable by revenue range order
5. Timeline - sortable by timeline priority
6. Status - sortable by status
7. Date - sortable by created_at
8. Actions (View button)

### 4. Wire Up Parent Component
Update `src/pages/admin/AdminUsers.tsx` to pass the new `onContactedChange` handler.

## Visual Design

```text
+----------+----------+---------+---------+----------+--------+------+--------+
| Contacted| Contact  | Company | Revenue | Timeline | Status | Date | Action |
+----------+----------+---------+---------+----------+--------+------+--------+
|   [x]    | Name ↕   | ACME ↕  | $5M ↕   | 6mo ↕    | New ↕  | Jan ↕| View   |
|   [ ]    | Jane     | Corp    | $10M    | 1yr      | New    | Feb  | View   |
+----------+----------+---------+---------+----------+--------+------+--------+
```

- Each sortable column header shows: current sort arrow (↑/↓) or neutral indicator (↕)
- Clicking a header toggles between ascending and descending
- Checkbox column updates immediately and shows toast confirmation

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/admin/use-owner-leads.ts` | Add `contacted_owner` to interface, add `useUpdateOwnerLeadContacted` hook |
| `src/components/admin/OwnerLeadsTableContent.tsx` | Add sorting logic, SortableHeader component, Contacted checkbox column |
| `src/pages/admin/AdminUsers.tsx` | Pass `onContactedChange` handler to table component |

## Technical Notes

- Revenue and Timeline sorting will use a priority map (e.g., `50m_plus` = 6, `under_1m` = 1) for logical ordering
- The existing `useSortableTable` hook from `src/hooks/ma-intelligence/` could be reused, but for simplicity we'll follow the inline pattern from `AllBuyers.tsx`
- Checkbox state changes will trigger immediate database updates with optimistic UI feedback
