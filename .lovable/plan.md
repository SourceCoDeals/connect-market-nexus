

## Restructure Message References -- Buyer and Admin Parity

### Problem

The reference picker exists on the buyer side but is buried behind a small `@` button that's easy to miss. More critically, **the admin ThreadView does NOT parse references at all** -- it renders raw `[ref:document:nda:NDA]` tags as plain text, and uses legacy emoji-prefix detection instead. Admins also have no way to reference documents/deals when replying.

### Changes

#### 1. Admin ThreadView: Parse and render reference chips

**File: `src/pages/admin/message-center/ThreadView.tsx`**

- Import `MessageBody` from `src/pages/BuyerMessages/MessageBody` and `ReferenceChip`/`parseReferences` from the buyer types
- Replace the raw `msg.body` paragraph (line 449-454) with the shared `MessageBody` component so `[ref:...]` tags render as styled chips
- Remove the legacy emoji-prefix detection (lines 432-447) -- the structured `[ref:...]` system supersedes it
- The `MessageBody` component already handles reference parsing, attachment rendering, and URL linking

#### 2. Admin compose bar: Add reference picker

**File: `src/pages/admin/message-center/ThreadView.tsx`**

- Import `ReferencePicker`, `ReferenceChip` from buyer-side components
- Add `reference` state and `encodeReference` to the send handler
- Replace the heavy border-2 Textarea compose bar with a cleaner single-line input matching the buyer-side pattern, with an `@` reference button
- When a reference is selected, show the `ReferenceChip` above the input (same as buyer side)
- On send, prepend `encodeReference(reference)` to the message body
- Admin needs access to thread context (deal info, documents) to populate the picker -- derive from the current `thread` prop (deal title, listing_id) and hardcode NDA/Fee Agreement as document options

#### 3. Buyer side: Make references more prominent

**File: `src/pages/BuyerMessages/MessageInput.tsx`**

- Add a subtle prompt row above the input when no reference is selected: "Tap @ to reference a deal or document" (in muted text, disappears once used)
- Make the `@` button slightly larger and add a label "Ref" next to it on wider screens

**File: `src/pages/BuyerMessages/ConversationList.tsx`**

- No structural changes needed -- already clean

#### 4. Shared components: Export for cross-use

**File: `src/pages/BuyerMessages/MessageBody.tsx`** and **`src/pages/BuyerMessages/ReferencePicker.tsx`**

- These are already importable. No changes needed, just consumed from admin side.

#### 5. Reference chip styling for admin context

**File: `src/pages/BuyerMessages/ReferencePicker.tsx`**

- The `ReferenceChip` already supports `variant: 'admin'` with appropriate styling
- Ensure the admin variant uses a slightly different background to distinguish "admin is referencing" vs "buyer is referencing" in the thread -- use a subtle gold tint for admin references

### Technical Summary

| File | Change |
|------|--------|
| `src/pages/admin/message-center/ThreadView.tsx` | Use `MessageBody` for message rendering; add reference picker to compose bar; remove emoji detection |
| `src/pages/BuyerMessages/MessageInput.tsx` | Add subtle prompt hint for `@` referencing |
| `src/pages/BuyerMessages/ReferencePicker.tsx` | Minor: refine admin variant chip color |

### What This Fixes

- Admin inbox renders `[ref:document:nda:NDA]` as a styled chip with icon instead of raw text
- Admins can reference documents, deals, and requests when replying to buyers
- Buyers see a clearer prompt to use the reference feature
- Both sides use the same `MessageBody` renderer, ensuring visual parity
- Legacy emoji-prefix document detection is removed in favor of the structured system

