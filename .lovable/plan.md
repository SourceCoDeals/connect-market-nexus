
# Fix: Data Room Modal Layout, Tracking, and View/Download Buttons

## Issues Found

### 1. Close button overlaps dark vault header
The `DialogContent` component renders a default `X` close button at `absolute right-4 top-4` with dark text. On the dark `#0E101A` vault header, this button is invisible or overlaps the "CONFIDENTIAL" text. Need to hide the default close button and add a custom one inside the vault header that's white.

### 2. Document dates shown to buyers
Lines 353-357 in `BuyerDataRoom.tsx` display `created_at` dates. Remove these — buyers should only see file name and size.

### 3. View/Download buttons likely fail silently
The `handleViewDocument` and `handleDownloadDocument` functions (lines 181-221) use `import.meta.env.VITE_SUPABASE_URL` directly. If the env var is missing, it falls back via the client module but these direct `fetch` calls would break. Also, there's no error feedback — if the response is not OK, nothing happens. Need to: use `SUPABASE_URL` from the client module instead of raw env var, and add error toasts.

### 4. Track data room open + document view/download timestamps for buyer side
The edge function already logs to `data_room_audit_log` — this covers admin-side tracking. For buyer-side, show "Last viewed" timestamps on documents by querying the audit log for the current user's events.

### 5. "Explore Data Room" button state after viewing
Once the data room modal has been opened, update the sidebar button to indicate it was viewed (e.g., checkmark or "Viewed" label).

## Implementation Plan

### File 1: `src/components/marketplace/BuyerDataRoom.tsx`

**Close button fix:**
- In `ListingDetail.tsx`, add `[&>button]:hidden` class to `DialogContent` to hide default close button
- Add a custom close button inside `VaultHeader` — white X icon on dark background, passed via `onClose` prop

**Remove dates:**
- Lines 353-357: Remove the `{new Date(doc.created_at).toLocaleDateString()}` and the pipe separator

**Fix View/Download:**
- Import `SUPABASE_URL` from `@/integrations/supabase/client` instead of using `import.meta.env.VITE_SUPABASE_URL`
- Add error handling with toast on non-OK responses
- Add user-facing "Last viewed" timestamp by querying `data_room_audit_log` for current user's view events on these documents

**Add document access timestamps (buyer side):**
- New query: fetch `data_room_audit_log` entries for current user + current deal's documents
- Show "Viewed [time ago]" or "Downloaded [time ago]" as subtle metadata under each document

### File 2: `src/pages/ListingDetail.tsx`

- Add `[&>button]:hidden` to DialogContent className to suppress default close button
- Track `dataRoomViewed` state — set to true when modal opens
- Pass `onClose={() => setDataRoomOpen(false)}` to `BuyerDataRoom`

### File 3: `src/components/listing-detail/ListingSidebarActions.tsx`

- Accept `dataRoomViewed` prop
- Show subtle checkmark or "Viewed" indicator on the "Explore data room" button after it's been opened

## Files to Change

| File | Change |
|------|--------|
| `src/components/marketplace/BuyerDataRoom.tsx` | Custom close button in header, remove dates, fix fetch URL, add error toasts, add "last viewed" timestamps |
| `src/pages/ListingDetail.tsx` | Hide default close button, pass onClose prop, track viewed state |
| `src/components/listing-detail/ListingSidebarActions.tsx` | Show "Viewed" indicator on data room button |

No database or edge function changes needed — `data-room-download` already logs to `data_room_audit_log`.
