

# Update Email Dashboard: Complete Catalog + View by Recipient

## What changes

### 1. Add "View by Recipient" toggle
Add a tab/toggle at the top of the "All Platform Emails" card: **By Category** (current default) | **By Recipient**. The "By Recipient" view groups all emails by their recipient address/type, so you can see at a glance every email a given address receives.

Recipient groups:
- `support@sourcecodeals.com` — all admin notifications, support inbox copies
- `Individual buyer` — all buyer-facing emails (lifecycle, messaging, agreements, deal flow)
- `Individual user` — password reset, user notification, contact response, data recovery
- `Invited buyer` — marketplace invitation
- `Referred buyer` — deal referral
- `Assigned admin` — task assigned
- `Previous deal owner` — deal owner change
- `Listing primary owner` — owner intro notification

Each group shows the email types, edge functions, and sender info in a table — same columns as the current view, just regrouped.

### 2. Verify all emails are listed
Cross-referencing edge functions against the catalog, everything is already present. No missing emails to add.

## Technical detail

### File: `src/components/admin/emails/AdminEmailRouting.tsx`
- Add `useState<'category' | 'recipient'>('category')` for the view toggle
- Add two tab buttons above the table in the "All Platform Emails" card header
- When `view === 'category'`: render existing category-grouped tables (no change)
- When `view === 'recipient'`: derive a `Record<string, EmailEntry[]>` by grouping `ALL_EMAILS` entries by their `recipient` field, sorted alphabetically by recipient. Render the same table structure but grouped by recipient instead of category, with a count badge per group

No new files, no new dependencies. Single file edit.

