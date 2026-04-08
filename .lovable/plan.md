
# Import Missing Webflow Leads from CSVs

## Current State

| Deal | CSV Leads | In DB | Missing |
|------|-----------|-------|---------|
| Saks Metering (`a6e20eba`) | 10 rows (9 unique) | 4 | **6 leads** (Joshua Klieger, Jack Harvey ×2, Kyle Tamboli, Jen Fair, Thomas Woldemariam) |
| Protegrity (`d136656a`) | 4 | 3 | **1 lead** (Brendan Doney) |
| ClearChoice (`85a0bef2`) | 1 | 1 | 0 |

Data quality for existing leads is good — names, emails, phones, roles, companies, and full messages are all stored correctly.

## What to do

Insert the 7 missing connection request rows directly into the database using the Supabase insert tool. Each row will:

- Set `source = 'webflow'` and `status = 'pending'`
- Map to the correct `listing_id`
- Populate `lead_name`, `lead_email`, `lead_phone`, `lead_company`, `lead_role`, `user_message`
- Store the full submission metadata in `source_metadata` (IP, date, page URL)
- Check each email against `profiles` table — if a match exists, set `user_id` to link the lead to their marketplace account

**Note**: Jack Harvey submitted twice to the Saks deal (2:48 PM and 3:34 PM) with slightly different messages and company names (`Duration Group` vs `durationgroup.com`). Both will be imported since they represent separate form submissions.

## Approach

1. Check if any of the 7 missing lead emails match existing marketplace profiles
2. Insert all 7 rows via the insert tool with complete data
3. Verify final counts match CSVs

No code changes needed — this is purely a data import.
