

# Fix: Data Room Access Not Granted on Connection Approval

## Root Cause (Two Gaps)

### Gap 1: Approving a connection request never creates a `data_room_access` record
The `handleAccept` function in `useConnectionRequestActions.ts` (line 85-145) updates the connection status to `approved`, sends emails and notifications, but **never inserts a row into `data_room_access`**. The `BuyerDataRoom` component queries `data_room_access` for the buyer's `marketplace_user_id` -- with no row, the buyer sees nothing.

### Gap 2: No automatic access provisioning flow exists
Currently, the only way a `data_room_access` row gets created is:
- Manually via the admin Access Matrix panel (admin clicks "Add Buyer" and toggles permissions)
- Via the AI command center (`grant_data_room_access` tool)

There is no automation connecting "connection approved" to "data room access granted."

## What the Buyer Experiences Today

1. Signs Fee Agreement and NDA
2. Requests connection on a listing
3. Admin approves the connection
4. Buyer sees "Explore data room" enabled in sidebar (because `feeCovered && connectionApproved` is true)
5. Clicks it, scrolls to `BuyerDataRoom` section
6. `BuyerDataRoom` queries `data_room_access` -- gets `null` -- renders nothing
7. Empty state: "No documents available yet"

## Solution

### File 1: `src/components/admin/connection-request-actions/useConnectionRequestActions.ts`

In `handleAccept` (after line 135, after notifications), add automatic `data_room_access` provisioning:

1. Check if a `data_room_access` record already exists for this buyer + listing
2. If not, insert one with:
   - `deal_id`: listing ID
   - `marketplace_user_id`: buyer's user ID
   - `can_view_teaser`: `true` (always granted on approval)
   - `can_view_full_memo`: `true` if fee agreement is signed, else `false`
   - `can_view_data_room`: `true` if fee agreement is signed, else `false`
   - `buyer_name`: from user object
   - `buyer_company`: from firm info if available

This uses the existing `data_room_access` table structure. The admin can still override via the Access Matrix.

### File 2: `src/components/marketplace/BuyerDataRoom.tsx`

Add a fallback for listings pushed from the queue: if `data_room_access` exists but no documents are found on the listing ID, also check the `source_deal_id` for documents. This handles the case where documents were uploaded to the source deal before the listing was created.

Lines 72-93: After the primary query returns empty, query for the listing's `source_deal_id` and fetch documents from there too.

### File 3: `src/pages/ListingDetail.tsx`

No changes needed -- the `BuyerDataRoom` already receives the listing ID and the sidebar already correctly gates on `feeCovered && connectionApproved`.

## Result

- Admin clicks "Accept" on a connection request
- `data_room_access` row is auto-created with teaser + full_memo + data_room access (if fee agreement signed)
- Buyer immediately sees documents in the data room section
- Documents from the source deal are also surfaced if the listing itself has none
- Admin can still fine-tune access via the Access Matrix

