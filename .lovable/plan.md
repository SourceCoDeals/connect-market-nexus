

## Fix: Build Error in AccessMatrixPanel.tsx

The preview won't load because of a syntax error at line 127 of `AccessMatrixPanel.tsx`.

### What's Wrong

The `handleToggle` function has a copy-paste error. It calls `updateAccess.mutate({...}` on line 120 but never closes the parenthesis — and then tries to reference a variable called `updates` on line 135 that was never declared.

### The Fix

**File: `src/components/admin/data-room/AccessMatrixPanel.tsx`**

Change line 120 from:
```
updateAccess.mutate({
```
to:
```
const updates = {
```

This makes lines 120-127 assign the object to `updates`, which is then used at line 130 (`setPendingUpdate(updates)`) and line 135 (`updateAccess.mutate(updates)`). The closing `};` on line 127 is already correct for an object assignment.

The dead-code check on line 129 (which duplicates line 116) will never trigger because line 116 already returns early for that case — but it's harmless and can be cleaned up later.

### Technical Details

- **Root cause**: Line 120 should declare a variable, not call `.mutate()` directly
- **Single-line change**: `updateAccess.mutate({` becomes `const updates = {`
- No other files affected

