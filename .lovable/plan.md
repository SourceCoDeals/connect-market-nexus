

# Mega Audit: Untested User-Facing Areas of the Marketplace

## What's Already Been Tested (Phases 1-11)
- Connection request gates (profile, fee, buyer type, NDA) on cards + detail pages
- `on_hold` status across all deal components
- Profile tabs (deep-linking, password change, documents, notifications)
- Document signing flow (Sign Now, on-demand download, admin notifications)
- RPC resilience for `get_user_firm_agreement_status` (3 callers hardened)
- My Deals page (deal selection, tabs, empty states, sorting)
- Messaging (deal threads, general chat, unread badges, agreement banners)
- Saved listings (save/unsave, annotations, pagination)
- Admin notification bell (document types, click routing)

---

## Untested Areas — Grouped by Priority

### A. Signup & Onboarding Flow
1. **Multi-step signup** (`/signup`) — 4 steps: Account, Personal, Buyer Type, Buyer Profile + referral source step. Draft persistence in localStorage. Step validation. Buyer-type-specific conditional fields.
2. **Signup success page** (`/signup-success`) — redirect behavior, email verification prompt
3. **Pending approval page** (`/pending-approval`) — NDA signing embed, status check polling, resend email, logout, redirect when approved
4. **Onboarding popup** — first-time marketplace visit, step progression, completion persistence to `profiles.onboarding_completed`
5. **Welcome page** (`/welcome`) — redirect if authenticated, CTA navigation

### B. Authentication Edge Cases
6. **Forgot password** (`/forgot-password`) — email submission, success feedback, rate limiting
7. **Reset password** (`/reset-password`) — token handling from email link, password update, redirect
8. **Auth callback** (`/auth/callback`) — OAuth/magic link token exchange
9. **Admin login** (`/admin-login`) — separate admin auth flow
10. **Session expiry** — heartbeat behavior, re-auth prompts, stale token handling
11. **Unauthorized page** (`/unauthorized`) — displays correctly, navigation back

### C. Marketplace Browsing & Discovery
12. **Filter panel** — search, category, location, revenue range, EBITDA range, reset, filter counts
13. **Matched deals section** — AI match scoring based on buyer profile, criteria count threshold, exclusion of saved/connected listings
14. **Deal alerts** (`CreateDealAlertDialog`) — creation, criteria selection (multi-category, multi-location, revenue/EBITDA ranges), success onboarding
15. **Pagination** — page navigation, per-page selector, URL persistence
16. **View toggle** — grid vs list layout, persistence
17. **Sort order** — relevance/newest/revenue sorting
18. **Tier 3 time-gating** — new listings hidden from Tier 3 buyers for a period
19. **Realtime indicator** — Wifi icon showing realtime connection status

### D. Listing Detail Page
20. **Investment fit score** — scoring accuracy per buyer profile, criteria breakdown, "Complete profile" CTA when missing data
21. **Similar listings carousel** — relevance, navigation, edge case with no similar listings
22. **Blurred financial teaser** — shown for non-connected buyers, proper blur/unlock behavior
23. **Deal advisor card** — contact info, messaging CTA
24. **Deal sourcing criteria dialog** — opens/closes, content accuracy
25. **Enhanced save button** — save/unsave toggle, annotation support
26. **Buyer data room** — document access gating, download tracking, orientation modal, folder grouping
27. **Custom sections** — admin-created content blocks rendering correctly

### E. Public Pages (No Auth Required)
28. **Owner inquiry** (`/sell`) — form submission, validation, URL processing, success redirect
29. **Owner inquiry success** (`/sell/success`) — confirmation display
30. **Deal landing page** (`/deals/:id`) — public deal view, mobile sticky bar, email capture, request form, related deals, metrics strip
31. **Data room portal** (`/dataroom/:accessToken`) — token validation, document listing, download with tracking, expired/invalid token handling
32. **Tracked document viewer** (`/view/:linkToken`) — link open tracking, first-open detection, download redirect, expired link handling
33. **Referral tracker** (`/referrals/:shareToken`) — partner authentication, deal list, referral submission form, CSV upload

### F. Buyer Messages Deep Dive
34. **General chat** — thread resolution via edge function, admin message read tracking, file attachments, reference chips
35. **Conversation list** — unread indicators, sorting, empty state
36. **Agreement section** — inline NDA/Fee signing within messages page
37. **Document dialog** — inline document viewing from messages
38. **Message input** — Enter-to-send, attachment upload, character limits

### G. Cross-Cutting Concerns
39. **Mobile responsive** — all buyer pages at 375px/390px/414px viewports, hamburger menu, touch targets
40. **Error boundaries** — `RouteErrorBoundary` wrapping every route, `ProductionErrorBoundary` at app level
41. **GA4 analytics** — page views, events (search, view item, generate lead, scroll depth, time on page)
42. **SEO** — dynamic `document.title`, meta descriptions, canonical URLs on public pages
43. **Protected route** — approval status check, redirect to `/pending-approval` for unapproved users
44. **Session tracking** — heartbeat provider, page engagement tracker

---

## Recommended Testing Phases

| Phase | Scope | Estimated Fixes |
|-------|-------|-----------------|
| 12 | Signup flow (steps, validation, draft persistence, buyer-type fields) | Medium |
| 13 | Pending approval + onboarding popup | Medium |
| 14 | Auth edge cases (forgot/reset password, callback, session expiry) | Low |
| 15 | Filter panel, pagination, sorting, matched deals, deal alerts | Medium |
| 16 | Listing detail deep dive (fit score, similar listings, blur teaser, data room) | Medium |
| 17 | Public pages (owner inquiry, deal landing page, data room portal, tracked docs) | Medium |
| 18 | Referral tracker page | Low |
| 19 | Mobile responsive audit across all buyer pages | High |
| 20 | Cross-cutting (error boundaries, GA4, SEO, protected routes) | Low |

Each phase would follow the same pattern: code audit → browser test → identify issues → fix → verify.

