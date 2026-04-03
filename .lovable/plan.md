
# Fix Ask-a-Question Properly End-to-End

## What I found

This is not fully implemented correctly yet.

### Root cause of the failure
The current inquiry creation hook inserts this into `connection_requests`:

```ts
source: 'inquiry'
```

But the database constraint for `connection_requests.source` only allows:

```text
marketplace, webflow, manual, import, api, website, referral, cold_outreach, networking, linkedin, email
```

So the insert can fail before the message is even created. That is the main reason your “Ask a question” flow is still breaking.

## What is also still incomplete vs your prompt

Your prompt asked for all of this:

1. Better text field for longer questions
2. Message must actually send
3. It must save into the user’s messages
4. It must auto-save the deal into Saved Deals
5. User should see the entire conversation history in Saved Deals

### Current status
- Better textarea: partially done
- Auto-save listing: partially done
- Save into user messages: likely works only if inquiry creation succeeds
- Entire conversation history in Saved Deals: not done yet

Right now `SavedListingMessages.tsx` only shows the last 3 messages and a link. That is not “their entire conversation history”.

## Correct implementation plan

### 1. Fix the inquiry creation architecture
Update the listing-sidebar inquiry flow so it does not create invalid `connection_requests.source` values.

Best fix:
- Change the inquiry creation to use a valid source such as `marketplace`
- Preserve inquiry intent in a safer way:
  - either via `source_metadata`
  - or by relying on existing `source='marketplace'` plus message/thread context

This avoids breaking the database constraint and keeps the thread valid everywhere:
- buyer messages
- admin message center
- saved deals
- notification flow

### 2. Make message creation robust and debuggable
Refactor `handleSendMessage` in `ListingSidebarActions.tsx` to separate the flow:

1. Ensure user is logged in
2. Resolve or create the thread
3. Send the message
4. Save the listing if needed
5. Refresh thread-related queries

Also improve error handling so the toast shows the real failure source:
- inquiry creation failed
- message insert failed
- save listing failed

### 3. Ensure the thread appears in buyer messages consistently
The thread list in `src/pages/BuyerMessages/useMessagesData.ts` already reads from `connection_requests` for the current user, so once inquiry creation is valid, the thread should appear there.

I will also make sure the send flow invalidates:
- `buyer-message-threads`
- `connection-messages`
- `deal-inquiry`
- saved listing queries

So the user immediately sees the conversation after sending.

### 4. Auto-save the deal reliably
The current auto-save is fire-and-forget after send. I’ll harden it so:
- it only runs after successful message send
- it does not silently fail the UX
- it refreshes Saved Deals immediately

If the listing is already saved, it will skip duplicate work.

### 5. Build full conversation history in Saved Deals
Replace the current compact “last 3 messages” block with a fuller Saved Deals conversation module.

New behavior:
- Show the full thread for that saved deal, not just 3 messages
- Add a collapsed/expanded layout so cards don’t become huge
- Default state can show a short preview with a clear “Show full conversation” control
- Expanded state shows the complete message history for that listing thread

This matches your requirement much better.

### 6. Improve the Ask-a-Question input UI
The current textarea is larger than before, but still not ideal.

I’ll improve it by:
- increasing default visible height
- making it auto-grow as the user types
- improving spacing between the field and send button
- making long text easier to review before sending
- keeping Enter/Shift+Enter behavior intuitive

## Files to update

### Core flow
- `src/components/listing-detail/ListingSidebarActions.tsx`
  - fix send flow
  - better textarea UX
  - stronger success/error handling
  - better query invalidation
  - reliable auto-save

- `src/hooks/marketplace/use-deal-inquiry.ts`
  - remove invalid `source: 'inquiry'`
  - create requests in a DB-compatible way
  - keep inquiry/deal-thread behavior intact

### Saved Deals conversation UX
- `src/components/marketplace/SavedListingMessages.tsx`
  - replace last-3-message preview with expandable full history

- `src/pages/SavedListings.tsx`
  - adjust placement/layout so conversation history fits cleanly under each listing

### Optional verification alignment
- `src/components/admin/emails/AdminEmailRouting.tsx`
  - update wording so messaging rows explicitly reflect that listing-side questions route through the same support notification flow once the thread is created successfully

## Expected result after this fix

When a buyer asks a question from the listing page:

1. A valid `connection_request` thread is created or reused
2. Their message is inserted into `connection_messages`
3. The thread appears in the buyer’s Messages area
4. The listing is automatically added to Saved Deals
5. The conversation becomes visible in Saved Deals
6. Support notification uses the same message notification path as other buyer messages

## Technical notes

```text
Current bug:
ListingSidebarActions
  -> useCreateInquiry()
     -> insert into connection_requests with source='inquiry'
     -> DB constraint rejects value
     -> no thread id
     -> message send never completes

Correct flow:
ListingSidebarActions
  -> useCreateInquiry() with valid source
  -> useSendMessage()
  -> notify-support-inbox
  -> save listing
  -> refresh buyer messages + saved deals
```

### Important scope note
I do not need to redesign the whole messaging system. The main issue is the invalid inquiry creation path plus the incomplete Saved Deals history UI.

### What will be true after the fix
- “Ask a question” will actually work
- Long questions will be visible while typing
- The deal will be auto-saved on first message
- The conversation will be visible in Saved Deals
- The thread will also live in the user’s Messages area
- Support notifications will follow the existing message-notification pattern

