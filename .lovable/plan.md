

# Audit: Plan Implementation Status

## All 5 Plan Items — Verified

| # | Plan Item | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Close button: hide default, custom white X in VaultHeader | DONE | `[&>button]:hidden` on DialogContent (line 308 ListingDetail.tsx). Custom `<button>` with white X in VaultHeader (lines 488-496 BuyerDataRoom.tsx). |
| 2 | Remove document dates from buyer view | DONE | No `created_at` rendering in document rows. Only `file_size_bytes` and audit timestamps shown (lines 400-408). |
| 3 | View/Download uses `SUPABASE_URL` from client + error toasts | DONE | Import on line 23: `import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'`. Error toasts on lines 228, 235, 258, 265. |
| 4 | Buyer-side audit timestamps on documents | DONE (but **broken**) | Query exists (lines 163-178), lookup built (lines 181-186), rendered in UI (lines 402-408). **However, the action filter is wrong.** |
| 5 | Sidebar "Viewed" indicator after opening data room | DONE | `useDataRoomLastAccess` hook queried on line 71 of ListingSidebarActions, rendered as "Viewed [date]" on lines 360-364. |

## Bug Found: Audit Timestamp Query Uses Wrong Action Names

**The edge function** (`data-room-download/index.ts` line 126) logs actions as:
- `'view_document'`
- `'download_document'`

**The buyer query** (`BuyerDataRoom.tsx` line 171) filters for:
- `'view'`
- `'download'`

These never match. The "Viewed 2 hours ago" / "Downloaded 3 hours ago" labels will **never appear** on any document.

### Fix

**File: `src/components/marketplace/BuyerDataRoom.tsx`**
- Line 171: Change `.in('action', ['view', 'download'])` to `.in('action', ['view_document', 'download_document'])`
- Lines 405: Change `lastEvent.action === 'download'` to `lastEvent.action === 'download_document'`

Two-line fix. Everything else is correctly implemented.

