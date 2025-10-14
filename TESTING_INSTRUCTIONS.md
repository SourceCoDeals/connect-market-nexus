# Bulk CSV Import - Testing Instructions

## 📝 Pre-Test Setup

1. **Ensure you're logged in as an admin user**
2. **Navigate to**: `/admin/pipeline`
3. **Have at least one active listing** to import deals for

## 🧪 Test Cases

### Test 1: Basic Valid Import
**Objective**: Verify basic CSV upload and parsing works

1. Click the "⋮" menu in pipeline header
2. Select "Bulk Import CSV"
3. Select any listing from dropdown
4. Download the test CSV: `/test-import-sample.csv`
5. Upload the test CSV file
6. Click "Parse CSV"

**Expected Results**:
- ✅ 5 valid rows shown
- ✅ 0 errors
- ✅ Preview table displays all 5 contacts
- ✅ Status icons all green checkmarks
- ✅ Company names cleaned (no URLs, quotes)
- ✅ Phone numbers formatted consistently
- ✅ Roles mapped correctly

7. Click "Import 5 Valid Rows"

**Expected Results**:
- ✅ Toast: "Successfully imported 5 connection request(s)"
- ✅ Import summary shows: 5 imported, 0 duplicates, 0 errors
- ✅ Dialog closes automatically
- ✅ Pipeline refreshes with new deals

### Test 2: Verify Database Creation

**Objective**: Confirm connection requests and deals were created

1. Open browser DevTools → Console
2. Run this query:

```javascript
const { data, error } = await supabase
  .from('connection_requests')
  .select('*, deals(*)')
  .eq('source', 'website')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Connection Requests:', data);
console.log('Error:', error);
```

**Expected Results**:
- ✅ 5 connection_requests returned
- ✅ Each has `source = 'website'`
- ✅ Each has `source_metadata.import_method = 'csv_bulk_upload'`
- ✅ Each has `source_metadata.csv_filename` set
- ✅ Each has a linked `deal` object
- ✅ `created_at` matches CSV dates (not import time)
- ✅ `lead_email`, `lead_name`, `lead_company` populated
- ✅ `user_id` is NULL (no matching profiles)

### Test 3: User Profile Matching

**Objective**: Verify user_id linking when email exists in profiles

1. Create a test user profile:

```javascript
const { data: profile } = await supabase
  .from('profiles')
  .insert({
    email: 'test.buyer@example.com',
    first_name: 'Test',
    last_name: 'Buyer',
    company: 'Example Corp',
    nda_signed: true,
    fee_agreement_signed: true
  })
  .select()
  .single();

console.log('Created profile:', profile);
```

2. Create new CSV with this email:

```csv
Date,Name,Email address,Company name,Phone number,Role,Message
10/14/2025 6:00:00 pm,Test Buyer,test.buyer@example.com,Example Corp,555-1234,Private Equity,"This is a test message for user profile matching. It needs to be at least 20 characters long to pass validation."
```

3. Import this CSV

**Expected Results**:
- ✅ Import successful
- ✅ Connection request has `user_id` = profile.id
- ✅ Connection request has `lead_email` = NULL
- ✅ Connection request has `lead_nda_signed` = true (synced from profile)
- ✅ Import summary shows "1 request linked to existing marketplace users"

### Test 4: Duplicate Detection

**Objective**: Verify duplicate detection works

1. Import the same CSV file again (from Test 1)

**Expected Results**:
- ✅ Toast: "All 5 entries were duplicates"
- ✅ Import summary shows: 0 imported, 5 duplicates, 0 errors
- ✅ Duplicate resolution dialog opens
- ✅ Shows side-by-side comparison of existing vs. new

2. Test each duplicate action:
   - **Skip**: Should move to next duplicate
   - **Merge**: Should append new message to existing
   - **Replace**: Should update existing request
   - **Create Anyway**: Should create new request with `forced_duplicate: true`

### Test 5: Validation Errors

**Objective**: Verify validation catches invalid data

Create a CSV with errors:

```csv
Date,Name,Email address,Company name,Phone number,Role,Message
10/14/2025 7:00:00 pm,X,invalid-email,Test Co,555-1234,Private Equity,Short
10/14/2025 7:00:00 pm,Valid Name,valid@test.com,Test Co,555-1234,Private Equity,"This message is long enough to pass the 20 character minimum validation rule."
```

**Expected Results**:
- ✅ Row 1: 3 errors shown
  - "Invalid or missing email"
  - "Name is required (min 2 chars)"
  - "Message must be at least 20 characters"
- ✅ Row 2: 0 errors (valid)
- ✅ Summary shows: 1 valid, 1 invalid
- ✅ Import button shows "Import 1 Valid Rows"
- ✅ Only valid row gets imported

### Test 6: File Size Limits

**Objective**: Verify file size validation

1. Try to upload a file > 10MB

**Expected Results**:
- ✅ Toast error: "File too large (X.XMB)"
- ✅ Toast description: "Maximum file size is 10MB"
- ✅ File input cleared

### Test 7: Row Count Limits

**Objective**: Verify row count validation

1. Create a CSV with > 500 rows
2. Upload and parse

**Expected Results**:
- ✅ Error displayed: "Too many rows (XXX). Maximum is 500 rows per import."
- ✅ No rows parsed
- ✅ Import button disabled

### Test 8: Audit Logging

**Objective**: Verify audit logs are created

1. After any successful import, check audit_logs:

```javascript
const { data: logs } = await supabase
  .from('audit_logs')
  .select('*')
  .eq('table_name', 'connection_requests')
  .eq('operation', 'BULK_IMPORT')
  .order('timestamp', { ascending: false })
  .limit(1);

console.log('Audit log:', logs[0]);
```

**Expected Results**:
- ✅ Audit log exists
- ✅ `metadata.csv_filename` set
- ✅ `metadata.rows_imported` matches actual
- ✅ `metadata.listing_id` matches selected listing
- ✅ `metadata.import_duration_ms` populated
- ✅ `admin_id` matches current user

### Test 9: Source Metadata

**Objective**: Verify source metadata is tracked

1. After import, check source_metadata:

```javascript
const { data: request } = await supabase
  .from('connection_requests')
  .select('source_metadata')
  .eq('source', 'website')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log('Source metadata:', request.source_metadata);
```

**Expected Results**:
```json
{
  "import_method": "csv_bulk_upload",
  "csv_filename": "test-import-sample.csv",
  "csv_row_number": 2,
  "import_date": "2025-10-14T...",
  "imported_by_admin_id": "uuid-here"
}
```

### Test 10: Historical Dates

**Objective**: Verify CSV dates are preserved

1. After import, verify `created_at` dates:

```javascript
const { data: requests } = await supabase
  .from('connection_requests')
  .select('created_at, source_metadata')
  .eq('source', 'website')
  .order('created_at', { ascending: false })
  .limit(5);

requests.forEach(r => {
  console.log('Created:', r.created_at);
  console.log('Imported:', r.source_metadata.import_date);
});
```

**Expected Results**:
- ✅ `created_at` matches CSV dates (not import time)
- ✅ `source_metadata.import_date` shows actual import time
- ✅ Dates sorted chronologically by CSV date

## 🐛 Known Issues to Watch For

1. **Date parsing**: If CSV dates are in different format, update `parseDate` function
2. **Timezone**: All dates imported as UTC - document this to users
3. **Large files**: Files near 10MB may be slow to parse
4. **Duplicate detection**: Only checks current listing, not across all listings

## ✅ Success Criteria

All tests should pass with:
- Connection requests created correctly
- Deals auto-created via trigger
- Duplicate detection working
- Validation catching errors
- Source metadata tracked
- Audit logs created
- User profile matching working
- Historical dates preserved

## 🚀 Ready for Production

Once all tests pass, the feature is production-ready!
