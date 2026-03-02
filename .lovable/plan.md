

## Fix "Update criteria" Link

**Problem:** The "Update criteria" button in the Matched Deals section links to `/welcome` (the public onboarding page), which redirects externally. It should link to the user's profile page where acquisition criteria can be edited.

**Fix:** In `src/components/marketplace/MatchedDealsSection.tsx` (line 138), change:

```
<Link to="/welcome">
```
to:
```
<Link to="/profile">
```

This routes to the existing `/profile` page (under buyer routes) where users can update their acquisition preferences, target industries, geography, and revenue ranges -- the same criteria used for deal matching.

**Files to change:** 1 file, 1 line.

| File | Change |
|------|--------|
| `src/components/marketplace/MatchedDealsSection.tsx` | Line 138: `/welcome` to `/profile` |

