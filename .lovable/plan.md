

# Real-Time Valuation Leads — Instant Display on New Submission

## Approach
The app already has a consolidated realtime admin channel (`use-realtime-admin.ts`) that subscribes to Postgres changes and invalidates query caches. The valuation leads query uses key `['remarketing', 'valuation-leads']`. The fix is simply adding a realtime listener for the `valuation_leads` table to that existing channel.

## Change

**`src/hooks/use-realtime-admin.ts`** — Add one `.on()` block to the existing channel:

```ts
.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'valuation_leads' },
  (payload) => {
    toast({
      title: '📊 New Valuation Lead',
      description: `A new lead has been submitted`,
    });
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
  },
)
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'valuation_leads' },
  () => {
    queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
  },
)
```

This triggers an automatic refetch of the leads query the instant a row is inserted or updated — no manual refresh needed. The existing `staleTime: 30_000` on the query won't block invalidation-triggered refetches.

**No other files need to change.** The realtime subscription requires that `valuation_leads` has Supabase Realtime enabled. I'll verify and enable it via a migration if needed.

