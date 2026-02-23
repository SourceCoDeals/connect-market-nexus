

# Deal Page & Pipeline Card Rebuild

## What's Changing

The deal detail panel and pipeline Kanban cards will be completely redesigned to serve as the central command center for each deal. The current scattered layout will be consolidated into a more actionable, information-dense interface.

---

## 1. Pipeline Kanban Card Redesign

The current card is text-heavy and hard to scan. The new card will be restructured for quick visual triage:

**New Card Layout:**
- **Header row**: Deal/listing title + deal score badge + priority/contact-owner flags (keep existing)
- **Key people row (NEW)**: Deal Owner name (left) and Buyer company + contact (right) -- both prominently displayed, not buried
- **Status strip**: NDA + Fee Agreement status dots (compact, single line)
- **Source + Stage duration**: Bottom metadata row (keep existing but tighter)
- Remove: next action text, last activity text, task progress, buyer connection count badge (these move to detail panel)

Result: Cards become ~40% shorter, scannable at a glance for "who owns this, who's the buyer, what's the score."

---

## 2. Deal Detail Panel -- New Tab Structure

Replace the current 6-tab layout (Overview / Buyer / Tasks / Documents / Email / Activity) with a redesigned 5-tab layout:

| Tab | Purpose |
|-----|---------|
| **Overview** | Interest summary, buyer message, related buyers, general notes, buyer profile sidebar |
| **Messages** | Real-time messaging thread (connection_messages integration) |
| **Data Room** | Document access control, sent/unsent tracking, activity log |
| **Tasks** | Keep existing task management |
| **Activity** | Audit trail (keep existing) |

---

## 3. Overview Tab (Rebuilt)

**Left column (main content):**
1. **Interest Expression** -- The buyer's original connection request message (already partially exists via ConnectionRequestNotes)
2. **Chat Preview** -- First 2-3 messages from the connection_messages thread with a "View All" link to the Messages tab
3. **Related Buyers** -- Other deals/buyers approved for the same listing (query deals table by listing_id, exclude current deal)
4. **General Notes** -- Comments section (move existing comments here, keep @mention support)

**Right sidebar (sticky metadata):**
- Deal Owner (assignable dropdown -- keep existing)
- Contact name + LinkedIn link
- Company name + website link
- Platform company + website (if available from profile)
- Buyer type + certainty/priority score
- Email + phone (clickable)
- Stage duration + deal age
- Follow-up status toggles (positive/negative -- move from current location)

---

## 4. Messages Tab (New)

Integrate the existing `connection_messages` system (already built in `src/hooks/use-connection-messages.ts`):

- Display the full real-time message thread between admin and buyer
- Use existing hooks: `useConnectionMessages`, `useSendConnectionMessage`, `useMarkMessagesReadAdmin`
- Admin can compose and send messages directly from this tab
- Messages auto-mark as read when the tab is opened
- Real-time updates via the existing Supabase realtime subscription
- Falls back to "No messaging available" for deals without a connection_request_id (remarketing-only deals)

---

## 5. Data Room Tab (New)

Consolidate document management into a single tab with three sections:

**Section A: Access Control**
- NDA toggle + status (sent/signed) with admin attribution
- Fee Agreement toggle + status with admin attribution  
- Teaser access toggle (new -- linked to document_distribution access grants)
- Full Memo access toggle (new)
- Data Room access toggle (new)
- Each toggle requires confirmation dialog (per existing access-control-confirmation-gate pattern)

**Section B: Sent/Unsent Tracker**
- Table showing: Document type | Status | Sent date | Sent by | Channel
- Pulls from existing document distribution and email tracking data

**Section C: Activity Log**
- Document-specific activity (who sent what, when access was granted/revoked)
- Pull from existing audit/activity infrastructure

---

## 6. Technical Implementation Details

**Files to modify:**
- `src/components/admin/pipeline/views/PipelineKanbanCard.tsx` -- Simplify card layout
- `src/components/admin/pipeline/PipelineDetailPanel.tsx` -- New tab structure (Overview, Messages, Data Room, Tasks, Activity)
- `src/components/admin/pipeline/tabs/PipelineDetailOverview.tsx` -- Complete rebuild with interest summary, chat preview, related buyers, buyer profile sidebar
- `src/components/admin/pipeline/tabs/PipelineDetailDocuments.tsx` -- Rename/rebuild as Data Room tab with access control + tracking
- `src/components/admin/pipeline/tabs/PipelineDetailCommunication.tsx` -- Replace with Messages tab using connection_messages

**New files to create:**
- `src/components/admin/pipeline/tabs/PipelineDetailMessages.tsx` -- Messaging interface wrapping existing hooks
- `src/components/admin/pipeline/tabs/PipelineDetailDataRoom.tsx` -- Unified data room with access control, document tracking, activity

**Files to remove:**
- Old `PipelineDetailCommunication.tsx` (replaced by Messages)
- Old `PipelineDetailDocuments.tsx` (replaced by Data Room)

**Existing hooks reused (no changes needed):**
- `use-connection-messages.ts` -- message CRUD + real-time
- `use-connection-request-details.ts` -- NDA/fee agreement status
- `use-lead-status-updates.ts` -- toggle NDA/fee agreement
- `use-deal-comments.ts` -- notes/comments
- `use-deal-emails.ts` -- email history

**Data queries added:**
- Related buyers query: `SELECT * FROM deals WHERE listing_id = ? AND id != ? AND deleted_at IS NULL` to show other approved buyers for the same deal
- Buyer profile enrichment: fetch from profiles table using resolved user_id (existing pattern from PipelineDetailBuyer)

---

## Implementation Order

1. Rebuild the Kanban card (visual change, no data model changes)
2. Create the Messages tab component
3. Create the Data Room tab component  
4. Rebuild the Overview tab with all new sections
5. Update the PipelineDetailPanel to wire up the new tab structure
6. Test end-to-end with real pipeline deals

