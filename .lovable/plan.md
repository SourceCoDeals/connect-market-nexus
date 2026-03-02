

## My Deals -- World-Class Redesign

### Vision

Transform the My Deals page from a cluttered, multi-component layout into a refined, information-dense-yet-breathable deal command center. Every pixel earns its place. The buyer should glance at this screen and instantly know: (1) where each deal stands, (2) what they need to do next, and (3) what's happening behind the scenes.

### Current Problems

1. **Visual clutter** -- Too many competing visual elements: navy header, green checkmarks, amber badges, progress bars, stepper dots, timeline connectors, status pills -- all fighting for attention
2. **Redundant status display** -- Deal progress shown 3 separate ways: DealDetailHeader pipeline stages, DealNextSteps horizontal indicator, AND DealProcessSteps vertical timeline. The same information rendered three times
3. **No clear "what to do next"** -- Status is shown but the single most important action is buried. A dealmaker needs one glance to know "Sign NDA" or "Expect reply within 3 days"
4. **Poor information hierarchy** -- The Overview tab stuffs DealNextSteps + DealProcessSteps + DealDetailsCard vertically with no breathing room
5. **Sidebar cards lack scannability** -- Pipeline progress bars with 6 tiny segments are hard to parse at a glance

### Design Philosophy

- **Single source of truth per concept** -- One status display, one next-action callout, one timeline
- **Information density without noise** -- Like a Bloomberg terminal meets Apple: every data point visible, nothing extraneous
- **Action-first** -- The single most important thing the buyer should do is the most prominent element on screen
- **Quiet luxury palette** -- Black, white, gold accents. No greens, no blues, no reds unless critical

### Architecture

The page will be restructured into these zones:

```text
+------------------------------------------------------------------+
|  Account Documents Banner (only if unsigned)                      |
+------------------------------------------------------------------+
|  SIDEBAR (320px)          |  DETAIL PANEL                        |
|                           |                                      |
|  Deal Card 1 [selected]   |  ┌─ Deal Header ──────────────────┐ |
|  Deal Card 2               |  │  Title · Category · EBITDA     │ |
|  Deal Card 3               |  │  Status Badge    View Listing →│ |
|                           |  └────────────────────────────────────┘ |
|                           |                                      |
|                           |  ┌─ Action Card ──────────────────┐  |
|                           |  │  "Sign your NDA to proceed"    │  |
|                           |  │  [Sign Now →]                  │  |
|                           |  └────────────────────────────────┘  |
|                           |                                      |
|                           |  ┌─ Deal Status ──────────────────┐  |
|                           |  │  Progress bar (single clean)   │  |
|                           |  │  Current stage explanation      │  |
|                           |  │  Expected timeline              │  |
|                           |  └────────────────────────────────┘  |
|                           |                                      |
|                           |  Tabs: Messages | Activity           |
+------------------------------------------------------------------+
```

### Detailed Changes

#### 1. Page Layout (`MyRequests.tsx`) -- Complete rewrite

- Remove the `#FCF9F0` cream background -- use pure white for the page
- Refined page header: just "My Deals" in 24px semibold, no subtitle
- Two-column layout with `360px` sidebar
- The AccountStatusBar becomes a slim inline banner at the very top (not a card)
- The DetailPanel restructured: no more nested Tabs for Overview. Instead, the "overview" content (action card + status + deal info) renders directly, with Messages and Activity as collapsible sections or secondary tabs below

#### 2. Sidebar Deal Cards (`DealPipelineCard.tsx`) -- Simplified

- Remove the 6-segment pipeline progress bar (too noisy, redundant with detail panel)
- Card layout: Title + Category/EBITDA on one line, status text + timestamp on second line
- Selected state: left gold border accent (keep) + subtle background
- Unread: small gold dot (not red numbered badge)
- Remove all the per-deal CTA buttons (signing is account-level)
- Clean, tight cards -- 3 lines max of information

#### 3. Detail Header (`DealDetailHeader.tsx`) -- Lighter

- Remove the heavy navy background entirely
- White background with a subtle bottom border
- Title left, EBITDA right, category/location as small text below title
- Remove the 6-stage pipeline checklist from the header (moved to status section)
- Add "View listing" link inline with title
- Status badge (Under Review / Connected / Not Selected) as a small pill

#### 4. New: Action Card (inline in DetailPanel)

A prominent, single-purpose card that tells the buyer exactly what to do next:
- **NDA not signed**: "Sign your NDA to unlock deal materials" + [Sign Now] button
- **Fee not signed**: "Sign your Fee Agreement to proceed" + [Sign Now] button  
- **Pending review**: "Your interest is being presented to the owner" + expected timeline
- **Approved**: "You're connected -- expect an email from our team shortly"
- **Rejected**: "This opportunity has been awarded to another buyer"

This replaces DealNextSteps, which tried to show everything at once.

#### 5. Deal Status Section (replaces DealProcessSteps + DealNextSteps)

A single, clean status display:
- Horizontal progress indicator with 4 stages (Interested / Documents / Review / Connected) -- simpler than 6
- Current stage highlighted with a brief 1-2 sentence explanation
- Timeline estimate inline ("Typically 3-7 business days")
- Remove the DealReviewPanel (message editor + profile status) from inside the timeline -- move the "Your Message" editor to a separate subtle section
- Remove WhileYouWaitChecklist from inside the timeline (becomes a small "suggestions" section at the bottom if needed)

#### 6. Deal Info Section (replaces DealDetailsCard)

- "Your Message" with inline edit capability
- "Buyer Profile" completion status
- "About this opportunity" description preview
- Submission date
- All rendered as clean key-value rows, not cards-within-cards

#### 7. Messages & Activity (keep as tabs, polish)

- Keep DealMessagesTab and DealActivityLog but render them cleaner
- Remove the redundant inner headers ("Messages", "Activity Log") since the tab already labels them
- Tighter message bubbles, consistent with the quiet luxury palette

#### 8. AccountStatusBar -- Inline banner

- Instead of a card with rows, make it a single-line banner:
  "NDA: Pending · [Sign Now]  |  Fee Agreement: Pending · [Sign Now]"
- Disappears when both signed

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/MyRequests.tsx` | Complete restructure: new layout, new DetailPanel with action card + unified status, remove DealNextSteps/DealProcessSteps from overview |
| `src/components/deals/DealPipelineCard.tsx` | Simplified card: remove pipeline bar, cleaner layout, gold dot unread |
| `src/components/deals/DealDetailHeader.tsx` | White background, remove navy theme, remove pipeline checklist, lighter |
| `src/components/deals/DealNextSteps.tsx` | Remove (replaced by inline action card in DetailPanel) |
| `src/components/deals/DealProcessSteps.tsx` | Simplify to a clean 4-stage indicator without embedded panels |
| `src/components/deals/DealDetailsCard.tsx` | Merge into DetailPanel as inline sections |
| `src/components/deals/DealReviewPanel.tsx` | Remove (message editor + profile status rendered directly) |

### Technical Notes

- All existing data hooks remain unchanged (`useUserConnectionRequests`, `useMyAgreementStatus`, `useBuyerNdaStatus`, etc.)
- The `AgreementSigningModal` integration stays the same
- Realtime subscriptions, notification marking, and sorting logic preserved
- Mobile responsive behavior maintained (single column on small screens)
- No new dependencies needed

