

# Pending Approval Page Redesign

## Current Problems

1. **Too narrow** (`max-w-md` = 448px) — cramped, feels like a small form, not a premium experience
2. **Too much redundant content** — "Submitted Information" card repeats what the user already knows; "Estimated Review Time" box and the bottom text say the same thing twice; "Questions?" appears twice
3. **Information hierarchy is flat** — everything is the same visual weight. Progress steps, agreement CTA, review time, submitted info all compete equally
4. **The agreement CTA is buried** — it's below 4 other sections. The most actionable thing on the page is the hardest to find
5. **Card-in-a-page pattern** — a Card inside a full-screen container wastes vertical space and makes it feel like an error page, not a dashboard

## Design Strategy

**Where they are mentally:** They just signed up. They're excited but uncertain. They want to know: "Did it work? What happens next? How long? Can I do anything right now?"

**What we need to communicate (in order of priority):**
1. You're in. Application received. (Relief)
2. Here's what you can do RIGHT NOW to get ahead. (Agency)
3. Here's the timeline. (Certainty)

**Layout concept:** Two-column on desktop (wide), single-column on mobile. Left side = status + timeline. Right side = the action (sign documents). This mirrors Stripe's onboarding pattern where status is contextual and the CTA is always visible.

## New Layout

```text
┌─────────────────────────────────────────────────────────┐
│                    SourceCo Logo                        │
│                                                         │
│          Application received                           │
│   A team member will review your profile and            │
│   approve access, usually within a few hours.           │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐     │
│  │  YOUR STATUS         │  │  GET AHEAD            │     │
│  │                      │  │                       │     │
│  │  ✓ Account created   │  │  While you wait,      │     │
│  │  ✓ Email verified    │  │  sign your documents  │     │
│  │  ○ Admin review      │  │  so you have instant  │     │
│  │    (few hours)       │  │  access the moment    │     │
│  │  ○ Full access       │  │  you're approved.     │     │
│  │                      │  │                       │     │
│  │  ──────────────────  │  │  NDA — protects the   │     │
│  │  Adam Haile          │  │  information we share  │     │
│  │  adambhaile@...      │  │                       │     │
│  │  TestCo              │  │  Fee Agreement — you   │     │
│  │  Private Equity      │  │  only pay if you close │     │
│  │                      │  │  a deal from SourceCo  │     │
│  └──────────────────────┘  │                       │     │
│                            │  [Request Documents]   │     │
│                            │                       │     │
│                            │  One signature covers  │     │
│                            │  every deal, now and   │     │
│                            │  in the future.        │     │
│                            └──────────────────────┘     │
│                                                         │
│  [Check Status]              [Sign out]                 │
│  Questions? adam.haile@sourcecodeals.com                 │
└─────────────────────────────────────────────────────────┘
```

On mobile (375px), the two columns stack vertically — status first, then the document CTA.

## Exact Copy

**Headline:** "Application received"
**Subhead:** "A team member will review your profile and approve access, usually within a few hours."

**Left column title:** "Your status"
- Step 1: "Account created" (green check)
- Step 2: "Email verified" (green check)
- Step 3: "Admin review" (amber dot, "Usually a few hours")
- Step 4: "Full access" (grey dot, "After approval")

Below steps, a subtle divider, then user details (Name, Email, Company, Type) in a compact list — no card wrapper, just quiet metadata.

**Right column title:** "Get ahead while you wait"
**Right column body:** "Sign your documents now so you have instant access the moment you're approved."

Two compact items:
- "NDA" — "Protects the confidential information we share with you"
- "Fee Agreement" — "Only applies if you close a deal sourced through SourceCo. No upfront cost."

CTA button: "Request Documents via Email"
Footer note: "One signature covers every deal, now and in the future."

If already signed: green confirmation replacing the entire right column.

## Visual Design Details

- **Width:** `max-w-3xl` (768px) — much wider, premium feel
- **Background:** Clean white page, no grey muted background
- **No Card wrapper** — the content breathes directly on the page
- **Progress steps:** Minimal dots (not big circles), thin connecting line
- **Right column:** Subtle `bg-stone-50` panel with `rounded-xl` and `border border-stone-200`
- **Typography:** Title in `text-2xl font-semibold`, subhead in `text-base text-muted-foreground`
- **CTA:** Full-width dark button (`bg-[#0E101A]`) inside the right panel
- **Footer actions:** `Check Status` and `Sign out` as ghost buttons in a row, not stacked

## Files Changed

| File | Change |
|------|--------|
| `src/pages/PendingApproval.tsx` | Complete rewrite of the JSX layout and styling. Same hooks and handlers preserved. Two-column grid layout, new copy, removed redundant sections. |

## Implementation Notes

- All existing handlers (`handleRequestBothDocuments`, `handleCheckStatus`, `handleLogout`, `handleResendVerification`) are preserved as-is
- The `email_not_verified` state keeps its own simpler single-column layout with the resend button
- The `rejected` state keeps its own layout
- Only the `approved_pending` state gets the two-column redesign
- Responsive: `grid-cols-1 md:grid-cols-2` with proper gap

