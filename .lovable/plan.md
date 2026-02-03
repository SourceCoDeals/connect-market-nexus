
# Fix Column Sorting Mismatches in All Deals Table

## Problem Summary

Clicking on **LI Count**, **LI Range**, and **Reviews** column headers does not sort the table because there are mismatches between the column identifier used in the header and what the sorting logic expects.

## Technical Details

The table headers use `SortableHeader` which sets a column name when clicked. This column name must match a `case` in the `sortedListings` switch statement. Currently:

| Column | Header Uses | Sort Has | Result |
|--------|-------------|----------|--------|
| LI Count | `linkedinCount` | `employees` | No sort |
| LI Range | `linkedinRange` | (nothing) | No sort |
| Reviews | `googleReviews` | (nothing) | No sort |

## Solution

Update the sorting switch statement to handle the correct column names:

### Changes to `src/pages/admin/remarketing/ReMarketingDeals.tsx`

1. **Replace the `employees` case** with `linkedinCount` (line ~973):
   ```typescript
   // BEFORE
   case "employees":
     aVal = a.linkedin_employee_count || 0;
     bVal = b.linkedin_employee_count || 0;
     break;
   
   // AFTER
   case "linkedinCount":
     aVal = a.linkedin_employee_count || 0;
     bVal = b.linkedin_employee_count || 0;
     break;
   ```

2. **Add missing `linkedinRange` case** (new case after linkedinCount):
   ```typescript
   case "linkedinRange":
     // Sort by the range's numeric portion (e.g., "11-50" → 11)
     const parseRange = (r: string | null) => {
       if (!r) return 0;
       const match = r.match(/^(\d+)/);
       return match ? parseInt(match[1], 10) : 0;
     };
     aVal = parseRange(a.linkedin_employee_range);
     bVal = parseRange(b.linkedin_employee_range);
     break;
   ```

3. **Add missing `googleReviews` case** (new case):
   ```typescript
   case "googleReviews":
     aVal = a.google_review_count || 0;
     bVal = b.google_review_count || 0;
     break;
   ```

## Expected Outcome

After these changes:
- Clicking **LI Count** will sort by LinkedIn employee count (numeric)
- Clicking **LI Range** will sort by the starting number of the range (e.g., "11-50" sorts as 11)
- Clicking **Reviews** will sort by Google review count (numeric)

All three will toggle between ascending/descending when clicked repeatedly, matching the behavior of the other sortable columns.

## Files Modified
- `src/pages/admin/remarketing/ReMarketingDeals.tsx` (lines 973-976, plus new cases)
