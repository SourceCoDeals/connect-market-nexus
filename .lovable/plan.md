
# Fix "Ask a Question" + Auto-Save Deal + Show Conversation History in Saved Deals

## Three Problems

1. **"Ask a Question" fails with "Failed to send"** — The `handleSendMessage` in `ListingSidebarActions.tsx` calls `createInquiry.mutateAsync(listingId)` which inserts into `connection_requests`. The error likely comes from the `useSendMessage` hook inserting into `connection_messages` using `as never` casts, or from the inquiry creation itself. Need to check edge function invocations and add better error logging.

2. **Textarea too small** — The current textarea is `min-h-[60px] max-h-[100px]`, making longer questions invisible. Need to make it auto-grow.

3. **No auto-save or conversation history in Saved Deals** — When a buyer sends a question about a listing, it should automatically save that listing to their saved deals. The Saved Listings page should show conversation history per listing.

## Plan

### Step 1: Fix "Ask a Question" send failure
- In `ListingSidebarActions.tsx`, add detailed error logging in the `handleSendMessage` catch block to surface the actual error
- In `use-deal-inquiry.ts` `useCreateInquiry`, the insert uses `message` column — verify this column exists on `connection_requests` and the insert payload matches the table schema
- The `useSendMessage` hook inserts with `as never` casts — ensure the payload fields match exactly (`connection_request_id`, `sender_id`, `sender_role`, `body`, `message_type`, `is_read_by_admin`, `is_read_by_buyer`)
- Add a try/catch around `createInquiry` separately from `sendMsg` to isolate which step fails

### Step 2: Improve the textarea
- Replace the fixed-height textarea with an auto-growing one: remove `max-h-[100px]`, set `min-h-[80px]` and allow natural growth up to `max-h-[200px]`
- Use `rows={3}` for a better default size

### Step 3: Auto-save listing when question is sent
- After a successful `sendMsg.mutateAsync()` in `handleSendMessage`, call the `useSaveListingMutation` to auto-save the listing (check if already saved first via `useSavedStatus`)
- Show a subtle toast: "Deal saved to your collection"

### Step 4: Show conversation history in Saved Listings
- Create a new component `SavedListingMessages.tsx` that fetches messages for a listing's connection request
- Uses `useDealInquiry(listingId)` to find the thread, then `useConnectionMessages(threadId)` to get messages
- Renders a compact message timeline (last 3 messages with "View all in Messages" link)
- Integrate into the Saved Listings page below each listing card (next to the existing annotation feature)

## Files Changed

- `src/components/listing-detail/ListingSidebarActions.tsx` — fix send logic, improve textarea, auto-save on send
- `src/components/marketplace/SavedListingMessages.tsx` — new component for conversation preview in saved deals
- `src/pages/SavedListings.tsx` — integrate conversation history per saved listing
