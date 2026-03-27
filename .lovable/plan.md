

# Fix: "Score All Unscored" Button Stuck with No Feedback

## Root Cause

Two problems:

1. **Too slow**: The button calls `queueBuyerQualityScoring()` which sends 130 individual edge function calls in batches of 2 with 500ms delays. That's 65 rounds × ~3-5 seconds each = **4-6 minutes** of waiting. The edge function already has a built-in `batch_all_unscored` mode that scores up to 500 users in a single call — the button isn't using it.

2. **No progress feedback**: The button shows a spinner but no count, no progress, no intermediate toasts. If the operation takes minutes or silently fails, the user has no idea what happened.

3. **Edge function timeout risk**: The `batch_all_unscored` mode processes sequentially inside one function invocation. With 130 users, each requiring 2-3 DB queries, this may exceed the 60s edge function timeout. The batch limit defaults to 30, so we should call it in chunks of 30 with progress updates.

## Fix

### File 1: `src/pages/admin/AdminUsers.tsx`

Replace `handleBulkScoreUnscored` to use the `batch_all_unscored` mode in a loop:

```typescript
const handleBulkScoreUnscored = async () => {
  setIsBulkScoring(true);
  let totalScored = 0;
  try {
    // Call batch_all_unscored in rounds of 30 until none left
    for (let round = 0; round < 10; round++) {  // safety cap
      const result = await invokeEdgeFunction<{ scored: number; results: unknown[] }>(
        'calculate-buyer-quality-score',
        { body: { batch_all_unscored: true, batch_limit: 30 } }
      );
      totalScored += result.scored;
      if (result.scored === 0) break;  // no more unscored
      toast({ title: `Progress: scored ${totalScored} so far...` });
    }
    toast({ title: 'Scoring complete', description: `Scored ${totalScored} users` });
    refetch();
  } catch (err) {
    toast({ variant: 'destructive', title: 'Scoring failed', description: (err as Error).message });
  } finally {
    setIsBulkScoring(false);
  }
};
```

This uses the existing `batch_all_unscored` mode which:
- Finds unscored users server-side (no need to pass IDs from client)
- Processes 30 at a time within the edge function timeout
- Loops until all are scored
- Shows progress toasts between rounds

### File 2: Button label update (same file)

Show progress count on the button text: `isBulkScoring ? "Scoring..." : \`Score All Unscored (${unscoredCount})\``

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/AdminUsers.tsx` | Switch to `batch_all_unscored` mode with progress toasts |

