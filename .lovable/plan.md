

## Overhaul My Deals Page -- Brand-Aligned, Functional, and Clean

### Problems Identified

1. **Colors are wrong** -- The page uses blue, green, amber, and navy colors that violate the SourceCo brand palette (Black #000000, Deep Charcoal #0E101A, Gold #DEC76B, Warm Grey #E5DDD0, Off-White #FCF9F0). The navy header, green check steps, blue timeline badges, and amber step backgrounds all clash with the premium monochrome-and-gold aesthetic.

2. **Visual clutter** -- The Overview tab stacks 4 heavy sections (DealNextSteps, DealMetricsCard, DealProcessSteps, DealDetailsCard) creating a wall of competing UI elements. The DealMetricsCard shows "N/A" everywhere and duplicates info already in the header. The DealProcessSteps timeline repeats status info. The "Off-Market" floating badge looks out of place.

3. **Signing flow unclear** -- The "Sign NDA" and "Sign Fee Agreement" buttons in DealNextSteps work (they open AgreementSigningModal), but the visual design doesn't create urgency. The steps mix completed/pending/locked states with inconsistent colors.

4. **ActionHub** navy bar competes with the DealDetailHeader navy bar -- two dark blocks stacked creates visual heaviness.

5. **DealPipelineCard** uses blue/green/amber stage colors instead of the brand palette.

6. **DealDetailHeader** pipeline stages use green checkmarks and blue highlights instead of gold/charcoal.

---

### Plan

#### 1. Rebrand DealDetailHeader to SourceCo palette
**File: `src/components/deals/DealDetailHeader.tsx`**

- Change background from `#0f1f3d` (navy) to `#0E101A` (Deep Charcoal)
- Replace green stage indicators (`rgba(42,125,79,...)`) with gold (`#DEC76B`) for completed stages
- Keep gold for current stage (already correct)
- Replace white/blue tag pills with `bg-white/10` (keep as-is, these are neutral)
- Update bottom highlight bars: completed = gold at reduced opacity, current = full gold

#### 2. Rebrand ActionHub to SourceCo palette
**File: `src/components/deals/ActionHub.tsx`**

- Change background from `#0f1f3d` to `#0E101A`
- Update the Zap icon container border to gold
- Chip hover states already use gold -- keep those
- The overall look stays but uses the correct charcoal base

#### 3. Rebrand DealNextSteps -- clean, premium styling
**File: `src/components/deals/DealNextSteps.tsx`**

- Replace green completed state (`bg-emerald-50`) with warm grey/gold tint (`bg-[#FCF9F0]` border `#E5DDD0`)
- Replace amber pending state (`bg-amber-50`) with gold-tinted (`bg-[#FBF7EC]` border `#DEC76B`)
- Replace slate locked state with muted warm grey
- Change completed check icon from green to charcoal/gold
- Change CTA button from `#0f1f3d` to `#0E101A`
- Add gold left accent bar on pending items for visual urgency

#### 4. Simplify the Overview tab layout
**File: `src/pages/MyRequests.tsx` (DetailPanel)**

- Remove DealMetricsCard from the Overview tab entirely -- it duplicates header info and shows N/A values. The financial data (Revenue, EBITDA, Employees, Location) is already shown in the DealDetailHeader and the DealMetricsCard below.
- Keep: DealNextSteps (top), DealProcessSteps (below), DealDetailsCard (bottom)
- This reduces the Overview from 4 sections to 3, removing the most visually cluttered element

#### 5. Rebrand DealMetricsCard (used in overview, keep for when data exists)
**File: `src/components/deals/DealMetricsCard.tsx`**

- Remove the floating "Off-Market" badge (visual noise)
- Replace green/blue status badge colors with brand palette
- Change "Under Review" badge to use `bg-[#FCF9F0] text-[#8B6F47] border-[#E5DDD0]` (already partially correct)
- Change "Approved" badge from emerald to gold-tinted

Actually, since we're removing it from Overview, this becomes lower priority. We'll still clean it up for the rare case it's shown elsewhere.

#### 6. Rebrand DealPipelineCard sidebar cards
**File: `src/components/deals/DealPipelineCard.tsx`**

- Change selected card border from `#0f1f3d` to `#0E101A`
- Gold accent bar stays (already brand-correct with `#c9a84c` -- close enough to `#DEC76B`, update to exact)
- Replace navy icon container on selected from `#0f1f3d` to `#0E101A`
- Replace pipeline bar navy segments from `#0f1f3d` to `#0E101A`
- Replace gold segments from `#c9a84c` to `#DEC76B`
- Replace amber/blue/green status pills with brand-aligned pills:
  - pending: warm gold tint
  - approved: charcoal with gold accent
  - rejected: muted grey
- CTA button: update from `#c9a84c` to `#DEC76B`
- Remove the colorful `stageColors` map (unused but declared)

#### 7. Rebrand DealProcessSteps timeline
**File: `src/components/deals/DealProcessSteps.tsx`**

- Replace `bg-gray-900` step indicators with `#0E101A`
- Replace blue timeline estimate banner (`bg-blue-50`) with warm gold tint (`bg-[#FCF9F0]` border `#E5DDD0`)
- Clock icon from blue to charcoal
- Keep the clean vertical timeline structure -- it's good

#### 8. Rebrand WhatsNew section
**File: `src/pages/MyRequests.tsx` (WhatsNewSection)**

- Replace blue/green/red badge backgrounds with brand-aligned warm tones
- Use gold-tinted badges for all notification types
- Update Sparkles icon from amber to gold

#### 9. Page background and header
**File: `src/pages/MyRequests.tsx`**

- Background `#faf8f4` is close to Off-White Gold `#FCF9F0` -- update to exact
- Header text `#0f1f3d` to `#0E101A`
- Deal count badge from `#0f1f3d` to `#0E101A`

---

### Files Changed (9 files)

| File | Summary |
|------|---------|
| `src/pages/MyRequests.tsx` | Remove DealMetricsCard from Overview, rebrand page bg/header, rebrand WhatsNew badges |
| `src/components/deals/DealDetailHeader.tsx` | Charcoal bg, gold stages, remove green |
| `src/components/deals/ActionHub.tsx` | Charcoal bg |
| `src/components/deals/DealNextSteps.tsx` | Gold/warm-grey step styling, gold urgency accents |
| `src/components/deals/DealPipelineCard.tsx` | Brand-aligned colors throughout |
| `src/components/deals/DealProcessSteps.tsx` | Charcoal indicators, warm timeline banner |
| `src/components/deals/DealMetricsCard.tsx` | Remove Off-Market badge, brand-align status colors |
| `src/components/deals/DealDetailsCard.tsx` | Minor text color updates to charcoal |
| `src/components/deals/DealDocumentsTab.tsx` | No functional changes needed -- signing status tracking already works via existing hooks |

### What stays the same
- All signing functionality (AgreementSigningModal, DocuSeal integration) -- already works correctly
- Admin document tracking pipeline (docuseal-webhook-handler, confirm-agreement-signed) -- untouched
- Messages tab, Documents tab, Activity Log tab -- functional, just color tweaks where needed
- Mobile layout logic
- URL deep-linking and notification read-marking

