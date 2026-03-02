

## Buyer Messages -- Premium Redesign

### Current Issues

1. **Layout feels cluttered** -- Three columns (280px sidebar + thread + 220px reference panel) compete for space. The Reference Panel duplicates information already visible in the Conversation List (deals, requests), creating redundancy.

2. **Visual noise** -- Too many 1px borders, inconsistent spacing, and the agreement banner feels bolted on rather than integrated.

3. **Deal selection works but isn't obvious** -- Users can already click deal threads in the sidebar to message about specific deals, but the UI doesn't communicate this clearly.

4. **Reference Panel is redundant on desktop** -- It shows the same deals/requests as the sidebar. On mobile the @ popover already handles this.

### Design Direction

Inspired by Apple Messages and Linear -- a clean two-column layout with generous whitespace, no visual clutter, and clear information hierarchy.

### Changes

#### 1. Remove the Reference Panel (ReferencePanel.tsx)

The right sidebar adds visual noise and duplicates sidebar content. The @ reference picker popover (already built) handles this on both mobile and desktop. The ReferencePanel will be removed from the layout entirely, giving the thread view more breathing room.

**Update `MessageInput.tsx`**: Show the @ reference picker button on all screen sizes (remove `md:hidden`), so desktop users can reference deals/documents via the popover instead of the removed panel.

#### 2. Redesign the main layout (index.tsx)

- Remove the outer page header ("Messages") -- let the content container itself be the full experience, edge-to-edge within the page area
- Move the title into the conversation list header area as a subtle label
- Remove outer padding/margins for a full-bleed container
- Two-column layout: conversation list (300px) + thread view (flex-1)
- Agreement banner integrated as a slim, dismissible strip at the very top of the container

#### 3. Polish the Conversation List (ConversationList.tsx)

- Header area: "Messages" title + "New Message" button, replacing the standalone search bar
- Search input becomes inline, toggled by a search icon
- "SourceCo Team" entry gets a subtle avatar circle (initials "SC") for visual distinction
- Thread items: tighter vertical rhythm, remove bottom borders between items and use subtle hover states only
- Unread indicator: small gold dot instead of numbered badge (cleaner)
- Selected state: full-width subtle background tint instead of left border

#### 4. Elevate the thread view (MessageThread.tsx, GeneralChatView.tsx)

- Thread header: minimal -- deal name left-aligned, "View deal" link right-aligned, no back button on desktop
- Message bubbles: slightly larger border radius (20px), more generous padding
- Compose bar: clean bottom-anchored bar with no top border -- use subtle shadow instead for float effect
- Typing indicator: more refined animation

#### 5. Streamline the Agreement Banner (AgreementSection.tsx)

- Single-line banner at top of the container
- Format: "[icon] NDA: Pending -- Sign Now | Fee Agreement: Pending -- Sign Now"
- Subtle warm background (#FEFDFB) with bottom hairline
- Collapses/hides entirely once both signed

#### 6. Skeleton and empty states

- Skeleton: match the new two-column layout
- Empty thread state: centered message with deal selection prompt

### Files Modified

| File | Change |
|------|--------|
| `index.tsx` | Two-column layout, remove Reference Panel, full-bleed container, integrated header |
| `ConversationList.tsx` | New header with title, avatar for SourceCo Team, dot badges, selected bg tint |
| `MessageThread.tsx` | Cleaner thread header, updated skeleton |
| `GeneralChatView.tsx` | Match new header style |
| `MessageInput.tsx` | Show @ picker on all screen sizes |
| `AgreementSection.tsx` | Single-line integrated banner |
| `ReferencePanel.tsx` | Remove (no longer imported) |
| `MessageList.tsx` | Refined bubble styling |

### Technical Notes

- No data layer changes needed -- the `GENERAL_INQUIRY_LISTING_ID` filter is already working
- The `ReferencePanel.tsx` file will be deleted and its import removed from `index.tsx`
- The `ReferencePicker` popover (mobile @ button) becomes the universal reference mechanism
- All existing functionality (send messages, attachments, references, typing indicators, read receipts, realtime) is preserved
- The layout remains responsive: on mobile, conversation list and thread view toggle visibility as before

