

# Reduce Whitespace Before Revenue Column

## Problem
The description column is set to 240px width with multi-line wrapping (`line-clamp-3`). The text wraps vertically into 3 lines but doesn't fill the horizontal space, creating excessive whitespace that cascades through Location into Revenue.

## Solution
Reduce the description column width from 240px to 180px. The 3-line display will still show the same amount of text vertically, just in a tighter horizontal space.

## Changes to `src/pages/admin/remarketing/ReMarketingDeals.tsx`

**Line 163** - Reduce description column width:
```typescript
// BEFORE
description: 240,

// AFTER  
description: 180,
```

## Result
- Eliminates the horizontal gap before Location/Revenue
- Still shows 3 lines of description text (same vertical content)
- More compact, denser table layout

