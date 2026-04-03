

# Add "New Message" Topic Picker to Messages Screen

## What We're Building

When a buyer clicks the compose/new message button (the `MessageSquarePlus` icon in the sidebar header), instead of just jumping to the general SourceCo Team chat, show a topic picker dialog that lets them choose what to message about:

1. **General Support** -- always available, routes to the existing SourceCo Team general chat
2. **Documents** -- always available, routes to general chat with a `@Document` reference pre-attached
3. **About a specific deal** -- only available if they have a signed fee agreement. Shows a list of marketplace listings they've interacted with (saved, connected, inquired). If fee agreement is not signed, the deal options are shown but disabled with a tooltip explaining they need to sign their fee agreement first.

## Access Rules

- **General support + Documents**: No fee agreement required. Anyone can message about these.
- **Deal-specific topics**: Requires signed fee agreement. If unsigned, deal options appear grayed out with an `(i)` tooltip: "Sign your Fee Agreement to message about specific deals."

## UX Flow

1. User clicks `MessageSquarePlus` button in ConversationList header
2. A small modal/popover appears with topic categories
3. User picks a topic:
   - "General Support" → opens GeneralChatView (same as today)
   - "Documents" → opens GeneralChatView with a document reference pre-set
   - A specific deal → opens GeneralChatView with a deal reference pre-set (or navigates to existing thread if one exists)
4. Modal closes, chat opens with context pre-attached

## Technical Changes

### 1. New component: `src/pages/BuyerMessages/NewMessagePicker.tsx`

A popover anchored to the compose button with three sections:
- **Quick Topics**: "General Support", "Documents (NDA & Fee Agreement)"
- **Your Deals**: List of deals from `threads` + any saved listings. Each deal row shows deal title. Disabled + tooltip if no fee agreement.

Uses `useFirmAgreementStatus()` to check `fee_agreement_signed` for the gate.

When a deal topic is selected:
- If a thread already exists for that deal → call `onSelectThread(threadId)` 
- If no thread exists → call `onSelectGeneral()` with a deal reference pre-set via `onReferenceChange`

### 2. `src/pages/BuyerMessages/ConversationList.tsx`

- Replace the direct `onSelectGeneral` call on the compose button with opening the `NewMessagePicker` popover
- Pass `threads`, agreement status, and callbacks as props

### 3. `src/pages/BuyerMessages/index.tsx`

- Pass `onReferenceChange` (the `setReference` setter) down to `ConversationList` so the picker can pre-attach a reference before opening the general chat
- Add a new callback `onStartNewMessage` that handles the picker's selection logic

### Files changed
- `src/pages/BuyerMessages/NewMessagePicker.tsx` -- new component (topic picker popover)
- `src/pages/BuyerMessages/ConversationList.tsx` -- wire compose button to picker
- `src/pages/BuyerMessages/index.tsx` -- pass reference setter and handle new message topic selection

