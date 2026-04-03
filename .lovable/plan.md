

# Fix Admin Replies Not Showing + Consolidate Admin Inbox by User

## Two Issues

### Issue 1: Admin replies to General Inquiry not visible to buyer

**Root cause**: The `resolve-buyer-message-thread` edge function returns the buyer's most recent active connection request (any deal). For this buyer, it returns the "Independent Wealth Advisory Firm" pending request instead of the General Inquiry thread. So the buyer's "SourceCo Team" chat shows messages from the deal thread, while the admin's reply went to the General Inquiry thread -- completely different `connection_request_id`.

**Fix**: Change `resolve-buyer-message-thread` to specifically look for the General Inquiry thread first (listing_id = `00000000-...01`). The "SourceCo Team" chat should always map to the General Inquiry thread, not an arbitrary deal thread. Deal-specific messages belong in the deal thread views.

Additionally, on the buyer side, the `useBuyerThreads` hook filters OUT the General Inquiry listing (line 113), which means the general inquiry thread's unread messages never show up in the conversation list. The GeneralChatView needs its own dedicated thread resolution that always returns the General Inquiry connection request.

### Issue 2: Admin inbox shows separate threads per connection request -- should consolidate by user

**Current state**: Each connection request is a separate thread in the admin inbox. One buyer with 3 connection requests = 3 inbox items.

**Proposed approach**: Group threads by `user_id` in the admin inbox list. Show one entry per buyer with their latest message across all threads. When an admin clicks on a buyer, show all their threads/contexts in the chat view with a thread selector to choose which connection request to reply in.

## Plan

### 1. Fix `resolve-buyer-message-thread` to always return General Inquiry thread

**File**: `supabase/functions/resolve-buyer-message-thread/index.ts`

Reorder the logic:
1. First, look for an existing General Inquiry thread (listing_id = internal UUID)
2. If found, return it (reactivate if rejected)
3. If not found, create one

This ensures the "SourceCo Team" chat always maps to the dedicated support thread, not a random deal thread.

### 2. Fix buyer-side General Chat to use dedicated General Inquiry thread

**File**: `src/pages/BuyerMessages/useMessagesData.ts`

Create a new hook `useGeneralInquiryThreadId()` that specifically queries for the connection request with `listing_id = GENERAL_INQUIRY_LISTING_ID`. The existing `useResolvedThreadId` can continue to call the edge function, but the edge function logic changes per step 1.

### 3. Consolidate admin inbox by user

**File**: `src/pages/admin/MessageCenter.tsx`

- After fetching threads, group them by `user_id`
- Each inbox list item shows: buyer name, company, total unread across all threads, latest message preview
- Show a count badge of how many active threads that buyer has

**File**: `src/pages/admin/message-center/ThreadListItem.tsx`

- Update to show consolidated buyer entry (all their threads' info merged)

**File**: `src/pages/admin/message-center/ThreadView.tsx`

- Add a thread/context selector at the top showing all connection requests for that buyer
- Admin picks which thread to reply in (e.g., "General Inquiry", "Independent Wealth Advisory Firm", "Premium Sod Farm")
- Messages from all threads shown in a unified timeline with thread labels, OR a tab selector to switch between threads

### 4. Add new types for grouped inbox

**File**: `src/pages/admin/message-center/types.ts`

Add a `BuyerGroup` type:
```
interface BuyerGroup {
  user_id: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_email: string | null;
  threads: InboxThread[];
  total_unread: number;
  last_activity: string;
  last_message_preview: string | null;
}
```

### Files changed
- `supabase/functions/resolve-buyer-message-thread/index.ts` -- fix to always resolve General Inquiry thread
- `src/pages/BuyerMessages/useMessagesData.ts` -- ensure GeneralChatView uses correct thread
- `src/pages/admin/MessageCenter.tsx` -- group threads by user_id
- `src/pages/admin/message-center/types.ts` -- add BuyerGroup type
- `src/pages/admin/message-center/ThreadListItem.tsx` -- update for grouped display
- `src/pages/admin/message-center/ThreadView.tsx` -- add thread selector for replying
- Deploy `resolve-buyer-message-thread`

