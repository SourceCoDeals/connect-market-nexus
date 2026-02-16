

## Plan: Clean Up Data Import / Bulk Import from ReMarketing Sidebar

### What Changes

1. **Delete** the Bulk Import page file (`src/pages/admin/remarketing/ReMarketingBulkImport.tsx`) and its related validation component (`src/components/remarketing/ImportValidationPanel.tsx`) if it is only used there.

2. **Add a "Settings" nav item** to the ReMarketing sidebar that links to `/admin/remarketing/settings`.

3. **Create a new Settings page** (`src/pages/admin/remarketing/ReMarketingSettings.tsx`) that contains the **Merge Deals** panel (reusing the existing `DealMergePanel` component) inside a collapsible card. This gives it a proper home without cluttering the main nav.

4. **Remove from sidebar**: Remove both "Data Import" and "Bulk Import" nav items from `ReMarketingSidebar.tsx`. Remove the now-unused `Upload` and `Database` icon imports.

5. **Update routing in `App.tsx`**:
   - Remove the `import` and `bulk-import` routes.
   - Remove the `ReMarketingBulkImport` import.
   - Replace `ReMarketingDataImport` import/route with the new `ReMarketingSettings` page at path `settings`.

6. **Delete the old Data Import page** (`src/pages/admin/remarketing/ReMarketingDataImport.tsx`) since the Merge Deals panel moves to the new Settings page.

### Technical Details

- **Files to delete**: `ReMarketingBulkImport.tsx`, `ReMarketingDataImport.tsx`
- **Files to create**: `ReMarketingSettings.tsx` (settings page with Merge Deals section)
- **Files to edit**: `ReMarketingSidebar.tsx` (swap 2 items for 1 Settings item), `App.tsx` (update routes/imports)
- **No changes** to any enrichment code, edge functions, or the `DealMergePanel` component itself

