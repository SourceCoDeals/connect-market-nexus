

## Rebuild Buyer Profile Page

### Overview

The current buyer profile page (`ReMarketingBuyerDetail.tsx`, 1213 lines) is a remarketing-centric view that shows company intelligence, transcripts, and AI scoring. It's missing critical operational data: **marketplace activity**, **cross-firm contact tracking via email domain**, **unified deal engagement timeline**, **document distribution history**, and **proper agreement tracking with DocuSeal status**.

This rebuild restructures the page into a **relationship-first CRM view** that tells the complete story of every interaction with a buyer organization.

---

### Current Problems

1. **Deal History is weak** -- Only shows remarketing scores (last 10), not marketplace connection requests or pipeline deals. No link to marketplace activity from users at the same firm (same email domain).
2. **Contacts are siloed** -- Only shows `remarketing_buyer_contacts`. Doesn't surface marketplace `profiles` sharing the same email domain, or `connection_request` lead contacts.
3. **Fee agreements are a toggle** -- No visibility into DocuSeal submission status, expiration dates, NDA tracking, or document URLs from `firm_agreements`.
4. **Materials/Documents are basic** -- `BuyerDealHistoryPanel` shows teaser/memo/data room access but is buried in a "Materials" tab. Should be front-and-center.
5. **No unified timeline** -- No way to see chronological sequence of: marketplace interest, remarketing match, approval, pipeline deal creation, memo sent, meeting scheduled.
6. **Intelligence tab is overloaded** -- 7 editable cards + transcripts all in one tab.

---

### New Page Structure

**Header** (keep existing `BuyerDetailHeader` + `CriteriaCompletenessBanner`)

**Top Cards Row** (2-column):
- Left: Company Overview (keep existing)
- Right: **Contacts Hub** (rebuilt) -- shows all contacts from 3 sources:
  - `remarketing_buyer_contacts` (existing)
  - Marketplace `profiles` matched via `email_domain` or `marketplace_firm_id`
  - `connection_requests` lead contacts (lead_email, lead_name matching domain)

**Tabs** (restructured):

| Tab | Content |
|-----|---------|
| **Engagement** (new, default) | Unified timeline of all deal interactions across marketplace + remarketing |
| **Intelligence** | Existing buyer criteria cards (business description, investment criteria, geography, etc.) |
| **Contacts** | Full contact management with source badges |
| **Agreements** | Rebuilt with full DocuSeal status, NDA + Fee Agreement lifecycle, document URLs, expiry |
| **Call History** | Existing Fireflies search |
| **Documents** | Materials shared across all deals |

---

### Technical Details

#### 1. New Hook: `use-buyer-engagement-history.ts`

Fetches a unified engagement timeline by combining:

- **Marketplace interests**: Query `connection_requests` joined with `listings` where `user_id` matches any `profiles.id` that shares the buyer's `email_domain` (via `firm_members` or direct email domain match). Fields: listing title, status, created_at, user name.
- **Remarketing scores**: Existing query on `remarketing_scores` for this buyer_id, joined with listings. Fields: listing title, score, tier, status.
- **Pipeline deals**: Query `deals` where `remarketing_buyer_id = buyerId` OR `connection_request_id` is in the set of connection requests from step 1. Fields: title, stage, value, assigned_to.
- **Document distributions**: From `get_buyer_deal_history` RPC (existing). Fields: deal, teaser/memo/data room access, memos sent count.

Returns a flat array sorted by date, each item tagged with `source: 'marketplace' | 'remarketing' | 'pipeline' | 'document'`.

#### 2. New Component: `BuyerEngagementTab.tsx`

Replaces current "Deal History" tab as the default tab. Shows:

- **Summary cards at top**: Total deals shown, Interested count, Pipeline active count, Documents shared count
- **Timeline table** with columns: Date, Deal/Listing, Source (badge), Status/Outcome, Stage, Documents Shared
- Each row is clickable to navigate to the relevant deal/listing/pipeline detail
- Filter chips: All, Marketplace, Remarketing, Pipeline

#### 3. New Hook: `use-buyer-all-contacts.ts`

Aggregates contacts from 3 sources:

```
Source 1: remarketing_buyer_contacts WHERE buyer_id = id
Source 2: profiles WHERE email LIKE '%@{email_domain}' (if email_domain exists)
Source 3: connection_requests WHERE lead_email LIKE '%@{email_domain}' (deduplicated by email)
```

Each contact gets a `source` badge: "Remarketing", "Marketplace", "Lead"

#### 4. Rebuilt Contacts Tab: `BuyerContactsHub.tsx`

- Shows unified contact list from all 3 sources with source badges
- Primary contact selector works across all sources
- "Add Contact" still creates `remarketing_buyer_contacts`
- Marketplace contacts are read-only (linked to profile page)
- Shows contact's own deal activity (which listings they expressed interest in)

#### 5. Rebuilt Agreements Tab: `BuyerAgreementsRebuild.tsx`

Uses `firm_agreements` data (already fetched via `marketplace_firm_id`) but shows much more:

- **NDA Section**: Status badge, DocuSeal submission status, signed document URL (download link), expiration date, redline notes, source
- **Fee Agreement Section**: Same detail level, plus scope (firm-wide vs deal-specific), deal linkage
- **DocuSeal Integration Status**: Shows if submission is pending, completed, or needs resending
- **Quick actions**: "Send NDA", "Send Fee Agreement" buttons (linking to existing DocuSeal flows)

#### 6. Refactored `ReMarketingBuyerDetail.tsx`

- Move tab default to "engagement" 
- Replace "history" tab content with `BuyerEngagementTab`
- Replace "contacts" tab with `BuyerContactsHub`
- Replace "agreements" tab with `BuyerAgreementsRebuild`
- Move "materials" (BuyerDealHistoryPanel) into "documents" tab
- Keep "intelligence" tab as-is (it works well for its purpose)
- Keep "call-history" tab as-is

### Files to Create
- `src/hooks/admin/use-buyer-engagement-history.ts` -- unified engagement data hook
- `src/hooks/admin/use-buyer-all-contacts.ts` -- cross-source contact aggregation hook
- `src/components/remarketing/buyer-detail/BuyerEngagementTab.tsx` -- new default tab
- `src/components/remarketing/buyer-detail/BuyerContactsHub.tsx` -- rebuilt contacts
- `src/components/remarketing/buyer-detail/BuyerAgreementsRebuild.tsx` -- rebuilt agreements

### Files to Modify
- `src/pages/admin/remarketing/ReMarketingBuyerDetail.tsx` -- restructure tabs, wire new components

### No Schema Changes Required
All data already exists across `remarketing_buyers`, `remarketing_scores`, `connection_requests`, `deals`, `profiles`, `firm_agreements`, `firm_members`, and `remarketing_buyer_contacts`. The rebuild is about querying and presenting it together.

