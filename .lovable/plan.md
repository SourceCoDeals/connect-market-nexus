# Accurate Attribution Data Plan

## ✅ IMPLEMENTED

The discovery source priority system has been implemented in `src/hooks/useUnifiedAnalytics.ts`.

### Changes Made

1. **Added `getDiscoverySource()` helper function** - Applies priority-based source resolution:
   - Priority 1: `original_external_referrer` (cross-domain tracking)
   - Priority 2: `utm_source` (explicit attribution like chatgpt.com)
   - Priority 3: `referrer` (immediate HTTP referrer fallback)

2. **Updated `extractDomain()` function** - Now handles non-URL values like `chatgpt.com` from utm_source

3. **Updated session query** - Added `original_external_referrer` to the select fields

4. **Updated all aggregation logic**:
   - Channel visitor counting now uses discovery source
   - Channel connection attribution now uses discovery source
   - Referrer visitor counting now uses discovery source
   - Referrer connection attribution now uses discovery source

### Result

ChatGPT and other sources with `utm_source` attribution will now appear correctly in:
- Channel card (as "AI" channel)
- Referrer card (as "chatgpt.com")
- All associated metrics (visitors, sessions, signups, connections)
