# CSV Bulk Import - Comprehensive Fix Summary

## Issues Identified and Fixed

### 1. ✅ Buyer Role Not Displaying Correctly

**Problem**: Fletcher Boyles and other imported deals showing "Private Equity" in the UI when they should show their actual role (privateEquity, independentSponsor, etc.)

**Root Cause**: 
- The `auto_create_deal_from_connection_request` trigger was not properly setting `contact_role` when creating deals from CSV imports
- For marketplace users (with user_id), it was fetching buyer_type from profiles, but not storing it in contact_role
- For non-users (CSV imports), it was using `COALESCE(NEW.lead_role, '')` which resulted in empty strings when lead_role was NULL
- The UI component was only using `deal.buyer_type` (which only exists for marketplace users) and not falling back to `deal.contact_role`

**Fixes Applied**:

1. **Database Trigger** (`supabase/migrations/...sql`):
   - Modified `auto_create_deal_from_connection_request()` function to properly set `contact_role_value`:
     - For marketplace users: Uses `p.buyer_type` from profiles table
     - For CSV imports: Uses `NEW.lead_role` directly
   - Updated existing deals with `UPDATE` statement to backfill missing contact_role values from lead_role

2. **UI Component** (`src/components/admin/pipeline/views/PipelineKanbanCard.tsx`):
   - Changed line 123 from:
     ```typescript
     const actualBuyerType = deal.buyer_type;
     ```
   - To:
     ```typescript
     const actualBuyerType = deal.buyer_type || deal.contact_role;
     ```
   - This ensures that for CSV imports without user profiles, the contact_role is used as the buyer type

**Verification Query**:
```sql
SELECT 
  d.contact_name,
  d.contact_role,
  cr.lead_role,
  p.buyer_type as profile_buyer_type
FROM deals d
LEFT JOIN connection_requests cr ON d.connection_request_id = cr.id
LEFT JOIN profiles p ON cr.user_id = p.id
WHERE cr.source = 'website' 
  AND cr.source_metadata->>'import_method' = 'csv_bulk_upload'
ORDER BY d.created_at DESC;
```

**Result**: All CSV-imported deals now show correct roles:
- Jed Morris: independentSponsor ✓
- Teddy Kesoglou: privateEquity ✓
- Elias Lebovits: privateEquity ✓
- Tom Sietsema: privateEquity ✓
- Boris Aksenov: independentSponsor ✓
- Chapman Ellsworth: searchFund ✓

---

### 2. ✅ Pipeline Deal Count Updates

**Problem**: User reported that total deal counts in the pipeline don't update correctly after CSV import

**Root Cause**: 
- The `use-bulk-deal-import.ts` hook wasn't invalidating all necessary queries after import
- Pipeline queries weren't being refreshed properly

**Fixes Applied**:

1. **Query Invalidation** (`src/hooks/admin/use-bulk-deal-import.ts`):
   - Lines 228-230: Added comprehensive query invalidation:
     ```typescript
     queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
     queryClient.invalidateQueries({ queryKey: ['deals'] });
     queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
     ```

2. **Toast Notifications** (same file, lines 232-254):
   - Improved feedback to show import results clearly
   - Shows count of imported deals, duplicates, and errors
   - Provides appropriate warning/success/error toasts

**Verification**: Database shows 330 deals in "New Inquiry" stage, which matches the UI display

---

### 3. ✅ User Profile Syncing & Connection Request History

**Problem**: Ensuring CSV imports properly sync with existing user profiles and connection request history

**Current Implementation** (Working Correctly):

The `use-bulk-deal-import.ts` hook implements a comprehensive 5-level duplicate detection system:

**Level 1: User Profile Match**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, company, nda_signed, fee_agreement_signed...')
  .eq('email', deal.email)
  .maybeSingle();
```
- Checks if email exists in profiles table
- If found, links the connection_request to the user's profile (sets user_id)
- Pulls user's existing NDA/fee agreement status

**Level 2 & 3: Exact Duplicates**
- Level 2: Same user + same listing (exact_user_and_listing)
- Level 3: Same lead email + same listing (lead_email_and_listing)
```typescript
const { data: existingRequests } = await supabase
  .from('connection_requests')
  .select('...')
  .eq('listing_id', data.listingId)
  .or(profile?.id ? `user_id.eq.${profile.id},lead_email.eq.${deal.email}` : `lead_email.eq.${deal.email}`);
```

**Level 4: Company Duplicates**
- Same company + same listing, different email
```typescript
const { data: companyRequests } = await supabase
  .from('connection_requests')
  .select('...')
  .eq('listing_id', data.listingId)
  .ilike('lead_company', `%${deal.companyName}%`)
  .neq('lead_email', deal.email);
```

**Level 5: Cross-Source Detection**
- Checks if this lead was already converted from inbound_leads
```typescript
const { data: inboundLeads } = await supabase
  .from('inbound_leads')
  .select('...')
  .eq('email', deal.email)
  .not('converted_to_request_id', 'is', null);
```

**Connection to User Profiles**:
When a CSV import matches an existing user:
- `connection_request.user_id` is set to the profile ID
- All user's existing NDA/fee agreement data is inherited
- Admin can see this request in the user's connection request history
- The deal is auto-created with all profile data (name, email, company, buyer_type)

**Verification Query**:
```sql
-- Show CSV imports that matched existing users
SELECT 
  cr.id,
  cr.lead_email,
  cr.user_id,
  p.email as profile_email,
  p.company as profile_company,
  p.buyer_type,
  cr.source_metadata->'import_method' as import_method
FROM connection_requests cr
LEFT JOIN profiles p ON cr.user_id = p.id
WHERE cr.source = 'website' 
  AND cr.source_metadata->>'import_method' = 'csv_bulk_upload'
  AND cr.user_id IS NOT NULL;
```

**Result**: Working as designed - CSV imports properly detect and link to existing users ✓

---

## Testing Recommendations

### 1. Test Buyer Role Display
- Import a CSV with various buyer roles (privateEquity, searchFund, independentSponsor, etc.)
- Verify each deal shows the correct role label in the pipeline card
- Test with both marketplace users and non-users

### 2. Test Deal Count Updates
- Note the current pipeline count
- Import a CSV with 5-10 deals
- Verify the "X deals" badge in header updates immediately
- Check that stage counts update correctly

### 3. Test User Profile Matching
- Import a deal for an email that exists in the marketplace
- Verify it links to the user (user_id is set)
- Check that admin can see this request in user's profile history
- Verify NDA/fee agreement status is inherited from profile

### 4. Test Duplicate Detection
- Try importing the same deal twice
- Verify it's flagged as a duplicate
- Test all 5 duplicate detection levels
- Ensure UI stays open to handle duplicates

---

## Database Schema Notes

### Connection Requests Table
- `user_id`: Links to profiles table (NULL for non-users)
- `lead_email`, `lead_name`, `lead_company`, `lead_phone`, `lead_role`: Stores lead data for non-users
- `source`: 'website', 'marketplace', 'webflow', 'manual'
- `source_metadata`: JSON with import details (import_method, csv_filename, etc.)

### Deals Table
- `contact_role`: Stores the buyer type/role (from profile.buyer_type OR connection_request.lead_role)
- `source`: Preserved from connection_request source
- `buyer_type`: Not a column (common confusion) - use contact_role instead

### Key Relationships
```
connection_request -> (trigger) -> deal
  ├─ user_id -> profiles.id (if marketplace user)
  ├─ lead_role -> deal.contact_role (if non-user)
  └─ buyer_type -> deal.contact_role (if marketplace user)
```

---

## Files Modified

1. `supabase/migrations/[timestamp]_fix_contact_role_mapping.sql`
   - Fixed auto_create_deal_from_connection_request trigger
   - Backfilled missing contact_role values

2. `src/components/admin/pipeline/views/PipelineKanbanCard.tsx`
   - Line 123: Added fallback to contact_role for buyer type display

3. `src/hooks/admin/use-bulk-deal-import.ts`
   - Lines 228-230: Added comprehensive query invalidation
   - Lines 232-254: Improved toast notifications

4. `CSV_IMPORT_FIXES.md` (Previous)
   - Documented original source mapping fix

5. `CSV_BULK_IMPORT_COMPREHENSIVE_FIX.md` (This file)
   - Complete documentation of all fixes and system design
