

# Deep Audit: Remaining Copy and Logic Issues

## Already Fixed (Confirmed)
- `ListingDetail.tsx` CTA copy — correct ("receive deal materials")
- `AgreementStatusBanner.tsx` locked banner — correct ("unlock full deal materials")
- `BlurredFinancialTeaser.tsx` body copy — correct ("receive deal materials from the advisor")
- `ConnectionButton.tsx` — correct ("deal materials")
- `ListingSidebarActions.tsx` gate — correct (`connectionApproved` only)
- `BuyerDataRoom.tsx` memo filtering by access level — correct
- `grant-data-room-access` email — correct ("deal materials")
- `notify-agreement-confirmed` full-access email — correct ("receive deal materials")

## Still Wrong — 6 Remaining Issues

### 1. `BlurredFinancialTeaser.tsx` — heading still says "Unlock the Data Room" (line 66)
The body copy was updated but the **heading** still reads "Unlock the Data Room." Should say "Unlock Deal Materials" or "Request Deal Access."

### 2. `notify-agreement-confirmed/index.ts` — NDA-only email still says "unlock full access to deals and the data room" (line 107)
The full-access branch was fixed but the NDA-only branch still over-promises data room access. Should say "To unlock full deal materials and request introductions, your Fee Agreement also needs to be signed."

### 3. `useConnectionRequestsFilters.ts` — duplicate approval message not updated (line 96)
There are TWO places that send the approval system message: `useConnectionRequestActions.ts` (fixed) and `useConnectionRequestsFilters.ts` (NOT fixed). The latter still says "You now have access to the deal overview and supporting documents in the data room." Must match the updated copy.

### 4. `EmailCatalog.tsx` — preview HTML says "Sign the NDA to unlock full access to the data room and financials" (line 227)
This is the email preview catalog for the templated approval email (NDA unsigned variant). Over-promises data room + financials.

### 5. `NdaGateModal.tsx` — says "unlock full access" (line 62)
"Sign either an NDA or Fee Agreement to unlock full access." This over-promises — signing only unlocks teaser-level access initially. Should say "Sign a Fee Agreement to access deal materials and request introductions."

### 6. `BuyerDataRoom.tsx` — upgrade prompt says "Sign Fee Agreement to unlock all documents" (line 333)
This is fine directionally but slightly misleading — signing the fee agreement doesn't guarantee all documents; admin toggles still control visibility. Should say "Sign Fee Agreement to unlock additional deal materials."

## Borderline / Acceptable (No Change Needed)

- **`send-templated-approval-email/index.ts`** (line 102-103): Says "Unlock full access" and "To view full deal details, access data rooms..." — This is the approval email sent to buyers. The language is accurate IN CONTEXT because it's explaining the full signing flow, not promising immediate access. The heading "Unlock full access" is describing what signing achieves. Acceptable.
- **`EmailTestCentre.tsx`**: Preview-only HTML for admin testing. Not buyer-facing. No change needed.
- **`ListingCardActions.tsx`** (line 196, 199): "Sign Fee Agreement to Unlock Access" / "unlock deal materials" — Already updated, accurate.
- **`DealDocumentsCard.tsx`** (line 348): "Sign an agreement to begin unlocking these materials" — Accurate; "begin unlocking" sets correct expectations.

## Files to Change

| File | Line | Change |
|------|------|--------|
| `src/components/listing-detail/BlurredFinancialTeaser.tsx` | 66 | "Unlock the Data Room" → "Request Deal Access" |
| `supabase/functions/notify-agreement-confirmed/index.ts` | 107 | "To unlock full access to deals and the data room" → "To unlock full deal materials and request introductions" |
| `src/components/admin/useConnectionRequestsFilters.ts` | 96 | Match updated approval message from `useConnectionRequestActions.ts` |
| `src/components/admin/emails/EmailCatalog.tsx` | 227 | "unlock full access to the data room and financials" → "unlock deal materials and request introductions" |
| `src/components/pandadoc/NdaGateModal.tsx` | 62 | "unlock full access" → "access deal materials and request introductions" |
| `src/components/marketplace/BuyerDataRoom.tsx` | 333 | "unlock all documents" → "unlock additional deal materials" |

## Post-Change
Redeploy `notify-agreement-confirmed` edge function. No other edge functions need redeployment (EmailCatalog is preview-only UI).

