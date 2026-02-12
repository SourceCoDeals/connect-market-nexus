

# Connect Google Sheet Sync (CapTarget)

The edge function code (`sync-captarget-sheet`) and database table (`captarget_sync_log`) already exist. We just need to wire up the final pieces to make it work.

## What's Already Done
- Edge function code at `supabase/functions/sync-captarget-sheet/index.ts` -- fully written
- `captarget_sync_log` table exists in the database
- All required `listings` columns (`captarget_row_hash`, `captarget_client_name`, etc.) are in place
- CapTarget Deals page exists at `/admin/remarketing/captarget-deals`

## What Needs to Happen

### Step 1: Register the Edge Function
Add the `sync-captarget-sheet` entry to `supabase/config.toml` with `verify_jwt = false` (so it can be called by a cron or external trigger without auth).

### Step 2: Add Required Secrets
Two secrets need to be configured in Supabase:

1. **GOOGLE_SERVICE_ACCOUNT_KEY** -- A Google Cloud service account JSON key with Sheets API read access. You'll need to:
   - Create a service account in Google Cloud Console
   - Enable the Google Sheets API
   - Share the target Google Sheet with the service account email
   - Download the JSON key file and paste its contents as the secret value

2. **CAPTARGET_SHEET_ID** -- The ID from the Google Sheet URL (the long string between `/d/` and `/edit` in the sheet URL)

3. Optionally: **CAPTARGET_TAB_NAME** -- defaults to "Sheet1" if not set

### Step 3: Deploy and Test
Deploy the edge function and run a test sync to confirm data flows from the sheet into the `listings` table with `deal_source = 'captarget'` and `status = 'captarget_review'`.

### Step 4: Near-Real-Time Trigger (Optional Enhancement)
For automatic syncing, one of these approaches:
- **Supabase Cron** (simplest): Call the function every 5-10 minutes via `pg_cron`
- **Google Apps Script trigger**: Add an `onEdit` script to the Sheet that calls the edge function URL whenever a row changes

---

## Technical Details

### Config.toml Addition
```toml
[functions.sync-captarget-sheet]
verify_jwt = false
```

### Data Flow
```text
Google Sheet (new/edited rows)
       |
       v
sync-captarget-sheet edge function
       |
       +-- Authenticates via service account JWT
       +-- Fetches all rows from the sheet
       +-- Deduplicates using SHA-256 hash of (client_name | company_name | date)
       +-- Inserts new rows / updates existing rows in `listings` table
       +-- Logs results to `captarget_sync_log`
       |
       v
CapTarget Deals page (/admin/remarketing/captarget-deals)
```

### Sheet Column Mapping (already coded)
| Sheet Column | Database Field |
|---|---|
| client_folder_name | captarget_client_name |
| Company Name | title, internal_company_name |
| Date | captarget_contact_date |
| Details | captarget_call_notes, description |
| Email | main_contact_email |
| First Name + Last Name | main_contact_name |
| Response | captarget_outreach_channel |
| Title | main_contact_title |
| Type | captarget_interest_type |
| URL | website |
| Phone | primary_contact_phone |

