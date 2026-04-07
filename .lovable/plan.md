

# Operations Hub -- Issues Found

## Bugs Identified

### 1. Document Signing Card: Wrong column name (WILL CRASH)
**Line 61**: Queries `document_type` but the actual column is `agreement_type`. Also queries `created_at` for time display but `requested_at` is the more meaningful timestamp. The join `firm_agreements!inner(firm_name)` should work since `document_requests.firm_id` has a FK to `firm_agreements(id)`.

### 2. Unread Messages Card: RPC does not exist (WILL CRASH)
**Line 125**: Calls `supabase.rpc('get_message_center_threads')` but no such RPC exists in the database. The existing `useMessageCenterThreads` hook fetches from `connection_messages` directly with client-side grouping. This card should reuse the existing hook or replicate its query.

### 3. Connection Requests Card: Ambiguous FK hint (MAY CRASH)
**Line 193**: Uses `profiles!inner(first_name, last_name)` but `connection_requests` has TWO FKs pointing at `profiles` (`connection_requests_user_id_profiles_fkey` and `connection_requests_converted_by_fkey`). PostgREST requires disambiguating with the FK name: `profiles!connection_requests_user_id_profiles_fkey(...)`.

### 4. Data Room Access Card: Missing column `buyer_company` (WILL CRASH)
**Line 324**: Queries `buyer_company` but the column is actually `buyer_firm`. Also queries `can_view_teaser, can_view_full_memo, can_view_data_room` but none of these columns exist on `deal_data_room_access`. The actual columns are `granted_document_ids`, `is_active`, etc.

### 5. Data Room Activity Card: Truncated user_id not useful
**Line 423**: Shows `log.user_id?.slice(0, 8)...` which is meaningless to admins. Would be better to show the action description from metadata or join to profiles.

## Fix Plan

| File | Change |
|------|--------|
| `src/components/admin/dashboard/OperationsHub.tsx` | **DocumentSigningCard**: Change `document_type` to `agreement_type` in both SELECT and display logic. Change `created_at` to `requested_at` in the ORDER BY and timeAgo call. |
| Same file | **UnreadMessagesCard**: Remove the broken RPC call. Instead, query `connection_messages` directly for recent unread messages (`is_read_by_admin = false, sender_role = 'buyer'`), join to `connection_requests` + `profiles` for buyer name, and count/group by `connection_request_id`. |
| Same file | **ConnectionRequestsCard**: Disambiguate the profiles FK: `profiles!connection_requests_user_id_profiles_fkey(first_name, last_name)`. |
| Same file | **DataRoomAccessCard**: Replace `buyer_company` with `buyer_firm`. Remove `can_view_teaser/can_view_full_memo/can_view_data_room` columns. Show access level based on `granted_document_ids` array length or just show buyer + firm + granted time. |
| Same file | **DataRoomActivityCard**: Join to profiles to show a name instead of truncated UUID. Fallback to UUID if join fails. |

All 5 fixes are in the same file. No new files, no migrations.

