

# Mega Audit Round 3: Untested & Overlooked Areas

## Status of Previous 38 Phases
All 38 phases (connection gates, RPC resilience, documents, messaging, deals, public pages, realtime, analytics, mobile) have been code-audited. Phases 1-11 included code fixes; phases 12-38 were verified clean.

## NEW: Critical Bug Found

### BlurredFinancialTeaser Bypasses All Connection Gates
**Severity: HIGH**

`BlurredFinancialTeaser.tsx` (line 33-36) opens a `ConnectionRequestDialog` directly on button click — it does NOT check:
- Profile completeness (`isProfileComplete`)
- Fee agreement status (`coverage.fee_covered`)
- NDA status
- Buyer type (business owners can click through)
- Listing status (inactive/sold)

The sidebar `ConnectionButton` properly enforces all 8 gates. But the bottom-of-page `BlurredFinancialTeaser` is a completely separate entry point that bypasses every single one.

The server-side `useRequestConnection` mutation does check `buyer_type` and message length, but does NOT check profile completeness, fee agreement, or NDA — so an incomplete-profile user could submit a connection request through this component.

**Fix:** Replace `BlurredFinancialTeaser`'s internal dialog/button with the same `ConnectionButton` component used in the sidebar, or add the same gate checks.

---

## Remaining Untested Areas (Phases 39-46)

### Phase 39: BlurredFinancialTeaser Gate Bypass Fix
- Add profile completeness, fee agreement, NDA, buyer type, and listing status checks to `BlurredFinancialTeaser.tsx`
- Or replace its CTA entirely with `ConnectionButton`
- Verify the `ConnectionRequestDialog` inside it cannot be triggered by incomplete/blocked users

### Phase 40: ConnectionRequestDialog — AI Draft Error Resilience
- `draft-connection-message` edge function error handling (line 66-80 of `ConnectionRequestDialog.tsx`)
- What happens if the edge function returns malformed data?
- Profile completion warning shown when `percentage < 60` — does the threshold align with `isProfileComplete` in `ConnectionButton`? (potential inconsistency: 60% vs the binary check)
- Empty message submission guard — currently checks `message.trim()` but the mutation requires 20+ chars; no client-side minimum length validation in the dialog

### Phase 41: ExecutiveSummaryGenerator — Window Popup & Print
- Uses `window.open()` to generate a print-ready HTML page — popup blockers will silently fail
- No fallback or error message when `summaryWindow` is null (line 14: `if (!summaryWindow) return;` — silent failure)
- Content includes real financial data — should it be gated behind NDA/connection status?

### Phase 42: DealSourcingCriteriaDialog — Submission & Calendar
- Inserts to `deal_sourcing_requests` table — does admin see these?
- Calendar embed (`setDialogState('calendar')`) — is the calendar URL hardcoded or configurable?
- Duplicate submission prevention — can a user submit multiple deal sourcing requests?
- What happens for unauthenticated users? (the button is on `ListingDetail` which requires auth)

### Phase 43: EnhancedSaveButton Share — Email Content Leakage
- `handleShare` constructs a `mailto:` link with listing title, location, revenue, and EBITDA in plaintext
- This exposes confidential deal financials via email to anyone — even if the recipient has no account
- The share URL (`/listing/{id}`) requires auth, but the email body itself contains the data
- Should financial figures be omitted from the share email body?

### Phase 44: SimilarListingsCarousel — Data Isolation
- `useSimilarListings` hook — does it enforce `is_internal_deal: false`?
- Could internal/remarketing deals leak into the similar listings section?
- Verify the query filters match the marketplace isolation guardrails

### Phase 45: BuyerDataRoom — Access Control Edge Cases
- `data_room_access` query uses `maybeSingle()` — correct for no-access case
- Document download via signed URLs — are URLs time-limited?
- What if `can_view_data_room` is false but `can_view_teaser` is true? Does the UI show partial content?
- `DataRoomOrientation` component — does it render even when there are 0 documents?

### Phase 46: Listing Detail — Cross-Cutting UX Issues
- `DealAdvisorCard` falls back to hardcoded "Tomos Mughan" when no `presented_by_admin_id` — is this intentional or a bug?
- Listing detail `isAdmin` check uses `user?.is_admin === true` — previous phases established this should use `useAuth().isAdmin`. Inconsistency risk.
- The `InvestmentFitScore` component renders a "Complete your profile" card for users with `criteriaCount < 2` — does this link to the correct profile tab?
- `listing_analytics` insert on unmount — if the component unmounts and remounts rapidly (React StrictMode), `hasFlushOnUnmountRef` prevents double-flush, but does StrictMode cause the ref to reset?

---

## Summary of New Findings

| Phase | Area | Severity | Type |
|-------|------|----------|------|
| 39 | BlurredFinancialTeaser gate bypass | **Critical** | Security bug |
| 40 | ConnectionRequestDialog validation gaps | Medium | UX/validation |
| 41 | ExecutiveSummaryGenerator popup blocker | Low | UX |
| 42 | DealSourcingCriteriaDialog admin visibility | Low | Feature gap |
| 43 | Share button leaks confidential financials | **High** | Data exposure |
| 44 | SimilarListingsCarousel isolation | Medium | Data isolation |
| 45 | BuyerDataRoom access edge cases | Medium | Access control |
| 46 | Listing detail cross-cutting issues | Low | Consistency |

## Proposed Execution Order

| Priority | Phases | Rationale |
|----------|--------|-----------|
| Critical | 39, 43 | Security: gate bypass and data leakage |
| High | 40, 44 | Validation gaps and data isolation |
| Medium | 45, 46 | Access control and consistency |
| Low | 41, 42 | UX polish |

