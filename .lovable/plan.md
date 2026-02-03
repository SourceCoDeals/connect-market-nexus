

# Attribution Deep Dive & Enhancement Plan

## Investigation Summary

I analyzed both Amber Tiger and Silver Panther's data in the database to understand the attribution behavior.

### Case 1: Amber Tiger (Newsletter Visitor)

**Database Data:**
- Referrer: `https://exdov.r.sp1-brevo.net/` (Brevo email tracking)
- UTM: `source=brevo`, `medium=email`, `campaign=Newsletter_deal_digest_1`
- Landing: `/listing/c0718940-06aa-4598-97a8-574501a6595d`

**What Happened:**
Amber clicked a direct listing link in the newsletter. The page tracker recorded the visit to `/listing/...` before the authentication check redirected them to `/welcome`. This is why "Viewed listing" appears in the event timeline even though they never actually accessed the listing content.

**Attribution Status:** Correct (Newsletter channel, Brevo source)

---

### Case 2: Silver Panther (Google → Blog → Marketplace)

**Database Data:**
```
referrer: https://www.sourcecodeals.com/
original_external_referrer: www.google.com  ← TRUE discovery source
blog_landing_page: /marketplace             ← Entry point on main site
```

**Full Journey Reconstruction:**
1. User searched Google
2. Clicked organic result to sourcecodeals.com
3. Navigated to sourcecodeals.com/marketplace page
4. Clicked through to marketplace.sourcecodeals.com/signup

**Attribution Status:** Cross-domain tracking is working perfectly. The system correctly identified Google as the original discovery source, not the immediate referrer (sourcecodeals.com).

---

## Current Gaps Identified

### Gap 1: Pre-Auth Page Views Inflate Metrics
Anonymous newsletter clicks to protected pages (like `/listing/...`) record page views before the redirect to `/welcome`. This shows "Viewed listing" in the timeline even though the user never saw the listing content.

### Gap 2: Full Journey Path Not Visualized
While we capture `original_external_referrer` (Google) and `blog_landing_page` (/marketplace), the User Detail Panel only shows the discovery source, not the full path:
```
Google → sourcecodeals.com/marketplace → marketplace signup
```

### Gap 3: Blog Entry Page Hidden
The `blog_landing_page` field is captured but not displayed in the User Detail Panel.

---

## Proposed Enhancements

### 1. Add Full Journey Path Visualization

Display the complete discovery journey in the User Detail Panel:

```
ACQUISITION
───────────────────────────────
Channel         Organic Search
Discovery Path  
  🔍 google.com
    ↓
  📄 sourcecodeals.com/marketplace
    ↓
  🏢 marketplace.sourcecodeals.com/signup
```

**Implementation:**
Update `UserDetailPanel.tsx` to display a journey path when `original_external_referrer` differs from `referrer`.

### 2. Display Blog Entry Page

Show the `blog_landing_page` in the acquisition section:

```
ACQUISITION
───────────────────────────────
Channel         Organic Search
Discovery       google.com
Blog Entry      /marketplace      ← NEW
Landing Page    /signup
```

**Implementation:**
- Add `blogLandingPage` to the `source` object in `useUserDetail.ts`
- Display it in `UserDetailPanel.tsx` when present

### 3. Add "Pre-Auth View" Indicator (Optional)

For page views that occurred before authentication (like Amber's listing views), add a visual indicator:

```
EVENT TIMELINE (3 EVENTS)
─────────────────────────────────────────────
📄 Viewed page (pre-auth)          /listing/... 
📄 Viewed page                     /welcome
```

**Implementation:**
- Compare page view timestamp with session `started_at`
- If the page is a protected route and occurred within 2 seconds of session start, mark as "pre-auth"

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUserDetail.ts` | Add `blogLandingPage` and `discoveryJourney` to source object |
| `src/components/admin/analytics/datafast/UserDetailPanel.tsx` | Display journey path and blog entry page |

### Data Flow Enhancement

```text
Session Data
├── original_external_referrer: "www.google.com"     → Discovery Source
├── blog_landing_page: "/marketplace"                → Blog Entry (NEW)
├── referrer: "https://www.sourcecodeals.com/"       → Immediate Referrer
└── first_touch_landing_page: "/signup"              → Marketplace Entry

Journey Display:
┌─────────────────────────────────────────┐
│ 🔍 www.google.com                       │ Discovery
│    ↓                                    │
│ 📄 sourcecodeals.com/marketplace        │ Blog Entry  
│    ↓                                    │
│ 🏢 /signup                              │ Marketplace Entry
└─────────────────────────────────────────┘
```

---

## Summary

The attribution system is working correctly. Both visitors have accurate discovery source data:

| User | Discovery | Status |
|------|-----------|--------|
| Amber Tiger | Brevo Newsletter | ✅ Correct |
| Silver Panther | Google (via blog) | ✅ Correct |

The recommended enhancements focus on **visualization improvements** to surface the full journey path, rather than attribution logic fixes.

