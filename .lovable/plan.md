

## Problem Summary

When an admin sends NDA and Fee Agreement to a buyer (e.g., tommughan@gmail.com) from the Connection Request screen, the buyer:
1. **Gets no in-app notification** -- because the notification is only created for "embedded" delivery mode, but the dialog defaults to "email"
2. **Has no visible place to find/sign these documents** -- there's no buyer-facing agreements page, and the signing banners only appear deep in specific listing detail pages

## Root Cause

In the `create-docuseal-submission` edge function (line 225), the buyer notification is gated behind `if (deliveryMode === "embedded")`. When the admin uses the default "Email Link" option (or "Generate Link"), no `agreement_pending` notification is created in `user_notifications`.

Additionally, even if a notification were created, clicking it just navigates to `/marketplace` with no clear way for the buyer to find their pending agreements.

## Plan

### 1. Always create buyer notifications (regardless of delivery mode)

**File:** `supabase/functions/create-docuseal-submission/index.ts`

- Remove the `if (deliveryMode === "embedded")` gate around the notification insert (lines 225-248)
- Always insert an `agreement_pending` notification when a submission is created, adjusting the message slightly based on delivery mode:
  - Embedded: "Please sign it in-app"
  - Email: "Check your email for the signing link"
  - Link: "A signing link has been shared with you"

### 2. Add a buyer-facing "My Agreements" section

**New file:** `src/components/buyer/BuyerAgreementsBanner.tsx`

- Create a prominent banner component that checks the buyer's firm agreement status
- Shows pending NDA/Fee Agreement with a "Sign Now" action
- For embedded mode: opens the NdaGateModal or FeeAgreementGate inline
- For email/link mode: shows "Check your email" or directs them to the signing link
- Display this banner on the Marketplace page and/or in a "My Deals" section

### 3. Improve notification click navigation

**File:** `src/components/buyer/BuyerNotificationBell.tsx`

- Update the `agreement_pending` handler to navigate to a more useful destination (e.g., `/marketplace` with a query param that triggers the signing modal, or to a dedicated profile/agreements section)

### 4. Add agreements banner to Marketplace page

**File:** `src/pages/Marketplace.tsx`

- Add the `BuyerAgreementsBanner` component near the top of the Marketplace page so buyers immediately see pending agreements when they log in

## Technical Details

- The `firm_agreements` table already has `nda_docuseal_status: "pending"` and `fee_docuseal_status: "pending"` for tommughan's firm -- the data is there, just not surfaced
- The `AgreementStatusBanner` component already exists but only shows on `ListingDetail` pages -- we can reuse/extend it for the marketplace
- The `get-buyer-nda-embed` edge function already handles fetching embed URLs for the buyer, so the in-app signing infrastructure exists
- Edge function will need redeployment after the notification gate fix

