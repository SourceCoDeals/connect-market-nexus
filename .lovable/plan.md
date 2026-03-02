

## Buyer Messages -- Premium Redesign with Always-Visible References

### Problem

From the screenshots, references are buried in a tiny popover triggered by an `@` button at the bottom. The conversation list shows raw `[ref:document:fee_agreement:Fee Agreem...` text. The overall layout lacks the Apple/Stripe-level clarity and premium feel requested.

### Design Direction

**Three-column layout** on desktop with a persistent right sidebar that makes Documents, Deals, and Requests always visible and one-tap accessible. No more hidden popovers.

```text
+------------------+---------------------------+--------------------+
| Conversations    |  Message Thread            | Quick Reference    |
| 280px            |  flex-1                    | 220px              |
+------------------+---------------------------+--------------------+
```

On mobile (below `md`), the right panel hides and the `@` button remains as fallback.

### Changes

#### 1. New file: `ReferencePanel.tsx` -- Always-visible right sidebar

A persistent 220px panel showing three sections stacked vertically:

- **Documents** -- NDA and Fee Agreement rows with status (Signed in green text, Pending in gold text). Each row is a button that attaches it as a reference. Active reference gets a `2px solid #DEC76B` left border.
- **Your Deals** -- List of deal threads showing title and category. Tap to reference.
- **Your Requests** -- Same threads but referencing the connection request ID, showing status.

Design tokens: white background, left border `1px solid #F0EDE6`, section headers `10px` uppercase `#CBCBCB`, items `12px` text, hover `#FAFAF8`, no shadows, no icons in headers.

#### 2. `index.tsx` -- Wire three-column layout

- Add `reference` and `setReference` state at the page level
- Pass `onSelectReference` callback to `ReferencePanel`
- Pass `reference` and `onReferenceChange` down to `BuyerThreadView` and `GeneralChatView`
- Wrap the message thread area + reference panel in a flex row
- Reference panel hidden below `md` breakpoint

#### 3. `MessageInput.tsx` -- Clean up compose bar

- Hide the `@` Ref button and hint text on `md+` screens (panel handles it)
- Keep them on mobile as fallback
- Tighter, cleaner compose bar

#### 4. `ConversationList.tsx` -- Decode reference tags in previews

- Use `parseReferences` to strip `[ref:...]` tags from `last_message_body` preview text and show cleaned text instead of raw tags
- Reduce width from `340px` to `280px` for better three-column proportions

#### 5. `MessageThread.tsx` + `GeneralChatView.tsx` -- Accept external reference state

- Accept `reference` and `onReferenceChange` as props from parent
- Pass them through to `MessageInput` (replacing local state)
- This enables the `ReferencePanel` in index.tsx to control the reference

#### 6. `AgreementSection.tsx` -- Minor polish

- Slightly tighter vertical spacing on the banner rows

### Visual Summary

- **Palette**: `#0E101A` text, `#DEC76B` gold accent, `#F0EDE6` dividers, `#F8F8F6` hover, `#FDFCF9` selected
- **No shadows** on any element
- **Typography-driven hierarchy**: section labels are 10px uppercase muted, items are 12px medium
- **Active reference**: gold left border + subtle background tint
- **Conversation previews**: cleaned of raw `[ref:...]` tags

### Files

| File | Change |
|------|--------|
| `src/pages/BuyerMessages/ReferencePanel.tsx` | **New** -- persistent sidebar with Documents/Deals/Requests |
| `src/pages/BuyerMessages/index.tsx` | Three-column layout, lift reference state, wire panel |
| `src/pages/BuyerMessages/MessageInput.tsx` | Hide `@` button on desktop, keep for mobile |
| `src/pages/BuyerMessages/ConversationList.tsx` | Width 280px, clean preview text with parseReferences |
| `src/pages/BuyerMessages/MessageThread.tsx` | Accept external reference/onReferenceChange props |
| `src/pages/BuyerMessages/GeneralChatView.tsx` | Accept external reference/onReferenceChange props |
| `src/pages/BuyerMessages/AgreementSection.tsx` | Tighter spacing |

