

# Fix Dates & Premium Redesign — Match Tool Leads

## Problem
1. **Dates are wrong**: All records show "5m ago" because `created_at` was set during backfill (all Mar 24). The real dates (Mar 6–24) are preserved in `raw_inputs.original_created_at`.
2. **Design needs elevation**: Current layout is functional but flat — needs a premium, minimal feel.

## Plan

### 1. Fix dates via SQL migration

```sql
UPDATE match_tool_leads
SET created_at = (raw_inputs->>'original_created_at')::timestamptz
WHERE raw_inputs->>'original_created_at' IS NOT NULL;
```

This corrects all 11 backfilled records in one statement.

### 2. Redesign `index.tsx` — premium minimal

**Date column**: Show formatted date like "Mar 6" or "Mar 24" (short month + day). For today's entries, show "Today". No more vague "5m ago".

**Visual elevation**:
- Lighter, more spacious rows with `py-4` padding
- Thinner font weights, `text-[13px]` body text
- Header row: no uppercase, use sentence case with `text-muted-foreground/70`, minimal weight
- Full-form rows: subtle warm emerald left accent (`border-l-[3px]`), no background tint — let the accent do the work
- Stage pills: remove borders, use soft filled backgrounds only (gray/blue/emerald)
- "Wants Buyers" badge: smaller, icon-less, just emerald pill text
- Financials: format cleanly — "$1M–5M rev · $500K–1M profit" instead of raw DB values like `1m_5m`
- Contact section: name in medium weight, email/phone in muted smaller text, no icons
- Remove dash placeholders for empty fields — just leave blank (cleaner)
- Location column: `text-muted-foreground` subtle styling
- Grid: slightly wider spacing, `gap-6` for breathing room

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/[timestamp]_fix_match_tool_dates.sql` | Update `created_at` from `raw_inputs.original_created_at` |
| `src/pages/admin/remarketing/MatchToolLeads/index.tsx` | Premium redesign + proper date formatting + clean financial labels |

