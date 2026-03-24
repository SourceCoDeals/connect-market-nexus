

# Add Delete Leads to Match Tool Leads

## Plan

### 1. Add `deleteLeads` mutation to `useMatchToolLeadsData.ts`

New mutation that hard-deletes selected leads by ID:
```typescript
const deleteLeads = useMutation({
  mutationFn: async (ids: string[]) => {
    const { error } = await supabase
      .from('match_tool_leads' as any)
      .delete()
      .in('id', ids);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['match-tool-leads'] });
    setSelectedIds(new Set());
    toast.success('Leads deleted');
  },
});
```

Return `deleteLeads` from the hook.

### 2. Add delete button + confirmation dialog to `index.tsx`

- Import `Trash2` icon and `AlertDialog` components
- Add a "Delete" button next to the existing "Not a Fit" button in the selection toolbar (red/destructive style)
- Add a confirmation `AlertDialog` that shows "Delete X lead(s)? This cannot be undone." with Cancel/Delete actions
- Wire it to `deleteLeads.mutate(Array.from(selectedIds))`

### Files Changed

| File | Change |
|------|--------|
| `useMatchToolLeadsData.ts` | Add `deleteLeads` mutation |
| `index.tsx` | Add delete button + confirmation dialog |

