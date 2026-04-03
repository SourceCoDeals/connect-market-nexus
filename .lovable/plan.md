

# Two New Features: "Agreement Signed" Notification Email + Listing Page Signing Encouragement

## Feature 1: Send Email When Admin Marks Agreement as Signed

### Problem
When an admin marks a buyer's NDA or Fee Agreement as "signed" via the Document Tracking dashboard, the buyer has no idea. They need an email telling them they can now request connection introductions on the marketplace.

### Implementation

**New edge function: `notify-agreement-confirmed`**
- Create `supabase/functions/notify-agreement-confirmed/index.ts`
- Uses `wrapEmailHtml()` from the shared wrapper
- Accepts: `recipientEmail`, `recipientName`, `agreementType` ('nda' | 'fee_agreement'), `firmName`
- Subject: `Your [NDA/Fee Agreement] has been confirmed`
- Body: Clean, minimal letter. Tells the buyer their document has been recorded, and they can now browse deals and request introductions. Single black CTA button: "Browse Deals" linking to `/marketplace`
- No emojis, no em dashes, no borders

**Hook into the existing "Mark Signed" flow:**
- In `src/hooks/admin/use-firm-agreement-mutations.ts`, inside the `onSuccess` handler of `useUpdateAgreementStatus` (around line 233), when `params.newStatus === 'signed'`:
  - After the existing `document_requests` update, invoke the new edge function for each firm member with an email
  - Pass the signer info and agreement type

**Update EmailCatalog.tsx:**
- Add a new entry under the "Agreements & Documents" category for this email

### Files Changed
- `supabase/functions/notify-agreement-confirmed/index.ts` (new)
- `src/hooks/admin/use-firm-agreement-mutations.ts` (add edge function call on signed)
- `src/components/admin/emails/EmailCatalog.tsx` (add catalog entry)

---

## Feature 2: Encourage Unsigned Buyers to Save/Bookmark Listings

### Problem
When a buyer without signed documents views a listing, the current UI shows the signing gate but doesn't proactively encourage them to save the listing so they can return after signing.

### Implementation

**Enhance the agreement gate block in `ConnectionButton.tsx`:**
- In the existing unsigned-user block (lines 180-291), add a prominent message encouraging them to save/bookmark the listing: "Save this listing so you can request access after signing."
- This sits alongside the existing "Sign an Agreement" card
- No new components needed. Just copy refinement and a visual nudge within the existing gate UI

**Enhance `ListingCardActions.tsx`:**
- In the grid/list card view, when `isNdaCovered` and `isFeeCovered` are both false, add a subtle text nudge near the save button: "Save for later. Sign your agreement to request access."

### Files Changed
- `src/components/listing-detail/ConnectionButton.tsx` (add save encouragement text in the agreement gate block)
- `src/components/listing/ListingCardActions.tsx` (add subtle nudge text when unsigned)

---

## Summary

Two changes:
1. New edge function + mutation hook update to email buyers when their agreement is marked signed, directing them to the marketplace
2. UX copy improvements on listing pages to encourage unsigned buyers to bookmark listings for later

