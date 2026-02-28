

# Salesforce Remarketing Webhook — Updated Plan

## Key Change: Contacts Data as Array

The current spec treats "Contacts Data" as a single object. In reality, Salesforce can send **multiple contacts** per Account. The plan must handle `Contacts Data` as either a single object OR an array of contact objects.

## Step 1: Database Migration

Add 18 new columns to `listings` table (unchanged from previous plan — `salesforce_account_id` with unique partial index + 17 `sf_*` columns).

## Step 2: Edge Function — `salesforce-remarketing-webhook`

Create `supabase/functions/salesforce-remarketing-webhook/index.ts`:

- CORS + POST-only enforcement
- Extract `body[0].body.salesforce_data`
- Validate `Account.Id` and `Account.Name`
- Build and upsert listing payload per field mapping spec
- **Contacts handling (updated):**
  1. Normalize `Contacts Data` — if it's a plain object, wrap it in an array; if already an array, use as-is; if null/missing, use empty array
  2. **First contact** with a valid email becomes the **primary**: sets `listings.main_contact_name/email/phone/title` and upserts into `contacts` with `is_primary_seller_contact = true`
  3. **Remaining contacts** with valid emails are each upserted into `contacts` with `is_primary_seller_contact = false`
  4. All contacts share: `contact_type = 'seller'`, `source = 'salesforce'`, `listing_id = <upserted listing UUID>`
  5. Upsert key for contacts: `email + listing_id`
  6. Phone fallback per contact: `Contact.Phone → Contact.MobilePhone → Account.Phone`
- Return `{ ok: true, salesforce_account_id, listing_id, contacts_upserted: <count> }`

Add `verify_jwt = false` in `supabase/config.toml`.

## Step 3: DealSourceBadge Update

Add `salesforce_remarketing` to `SOURCE_CONFIG` in `DealSourceBadge.tsx` with teal color and "Salesforce" label.

## Step 4: Salesforce Tab Filter

Add `{ key: 'salesforce', label: 'Salesforce' }` tab to deal filters. Filter logic: `deal_source === 'salesforce_remarketing'`.

## Step 5: SalesforceInfoCard Component

Create card component for deal detail page (teal accent, following `CapTargetInfoCard` pattern):
- 4-column grid: Remarketing Reason, Interest in Selling, Tier, Target Stage
- Collapsible sections: Note Summary, Historic Notes, Internal Remarks
- SF IDs in monospace, formatted dates

## Step 6: Deploy

Webhook URL: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/salesforce-remarketing-webhook`

