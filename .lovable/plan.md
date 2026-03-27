

# Polish Tier & Score Display + Add Column Header Tooltips

## Current Problems
- **Tier badge**: Colorful pill with "T1 · Platform Add-On" text — too busy, multiple competing colors
- **Score badge**: Colored border + TrendingUp icon + tooltip — overdesigned for a table cell
- **Column headers**: Plain text "Tier" and "Score" with no explanation of what they mean

## Design Direction (Quiet Luxury)
- Replace colorful badges with **neutral, monochrome indicators** using subtle shade differences
- Tier: simple text like "T1" with a muted descriptor, no colored background — just font weight and subtle text color
- Score: plain numeric display with a thin neutral pill, no icon — color only as a subtle left-border or dot accent
- Column headers: wrap "Tier" and "Score" in tooltips with a small `HelpCircle` icon (or dashed underline) that explains the column on hover

## Changes

### File 1: `src/components/admin/BuyerQualityBadges.tsx`

**BuyerTierBadge** — redesign:
- Remove colored `Badge` component
- Render as: `T1` in semibold + "Platform Add-On" in muted text, inline
- Override indicator: subtle `★` prefix
- Use neutral grays only — no green/blue/amber backgrounds
- Wrap in Tooltip showing full tier explanation:
  - T1: "Verified buyer with active platform — highest acquisition intent"
  - T2: "Buyer with committed capital and verified fund"
  - T3: "Independent sponsor or search fund — flexible capital"
  - T4: "Unverified or incomplete buyer profile"

**BuyerScoreBadge** — redesign:
- Remove TrendingUp icon and colored borders
- Render as a plain number in a small neutral rounded container
- Use only a subtle dot or left accent for strength indication (emerald dot for 70+, amber for 40-69, muted for <40)
- Tooltip on hover: "Quality score (0-100) based on buyer type, capital, and profile completeness"

### File 2: `src/components/admin/UsersTable.tsx`

**Column headers** — add tooltip wrappers:
- "Tier" header → wrap in `Tooltip` with: "Buyer classification (T1-T4) based on capital structure and verification level. T1 = Platform Add-On, T2 = Committed Capital, T3 = Independent Sponsor, T4 = Unverified."
- "Score" header → wrap in `Tooltip` with: "Quality score (0-100) computed from buyer type, available capital, profile completeness, and acquisition signals."
- Show a dashed underline on the header text to signal it's hoverable
- Use existing `Tooltip`/`TooltipProvider` components

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/BuyerQualityBadges.tsx` | Redesign both badge components to minimal/neutral style with explanatory tooltips |
| `src/components/admin/UsersTable.tsx` | Add tooltip wrappers to Tier and Score column headers |

