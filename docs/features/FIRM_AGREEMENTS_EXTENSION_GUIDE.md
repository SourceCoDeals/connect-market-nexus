# 🏢 Firm Agreements Extension - Implementation Guide

## Overview

The firm agreements system has been extended to automatically track and manage agreements for **manually imported leads** and **pipeline contacts** in addition to marketplace-registered users. This ensures consistent agreement status across all channels while maintaining data integrity.

---

## ✅ What Was Implemented

### Phase 1: Database Schema Extensions

**New Columns:**
- `inbound_leads.firm_id` - Links leads to firms
- `connection_requests.firm_id` - Links connection requests to firms

**New Indexes:**
- `idx_inbound_leads_firm_id` - Fast firm lookups for leads
- `idx_connection_requests_firm_id` - Fast firm lookups for requests
- `idx_inbound_leads_email_domain` - Domain-based matching
- `idx_inbound_leads_company_normalized` - Company name matching

### Phase 2: Automatic Firm Detection

**Trigger: `auto_link_lead_to_firm()`**
- Fires on INSERT/UPDATE of `inbound_leads` table
- Matches leads to existing firms by:
  - Normalized company name
  - Email domain (excluding generic domains like Gmail)
  - Website domain
- Creates new firm if no match found
- Excludes generic email domains: gmail.com, yahoo.com, hotmail.com, outlook.com, icloud.com, aol.com

**Trigger: `sync_connection_request_firm()`**
- Fires on INSERT/UPDATE of `connection_requests` table
- Inherits firm from three sources:
  1. **Marketplace users:** Gets firm from `firm_members` table
  2. **Lead-based requests:** Gets firm from `inbound_leads` table
  3. **Manual requests:** Matches by company name/email domain
- Applies "most permissive" rule for agreement status:
  - If firm OR request has signed status → marked as signed
  - Prevents losing signed agreements during matching
  - Updates firm if request has signed status but firm doesn't

### Phase 3: Agreement Status Cascading

**Updated RPC: `update_lead_fee_agreement_status()`**
- Now checks for `firm_id` on connection request
- If firm exists → calls `update_fee_agreement_firm_status()` to cascade to all members
- If no firm but has `user_id` → updates individual user profile
- Updates associated deals automatically

**Updated RPC: `update_lead_nda_status()`**
- Same cascading logic as fee agreement
- Calls `update_nda_firm_status()` when firm exists
- Maintains individual user updates as fallback

### Phase 4: Realtime Synchronization

**Added to Supabase Realtime:**
- `firm_agreements` table - broadcasts firm-level changes
- `firm_members` table - broadcasts member changes

**Updated `useRealtimeAdmin` Hook:**
- Listens for firm agreement changes
- Invalidates affected queries:
  - `firm-agreements`
  - `admin-users`
  - `connection-requests`
  - `inbound-leads`
  - `deals`
- Enables multi-admin collaboration with instant updates

### Phase 5: Data Migration

**Backfill Scripts:**
1. **Inbound Leads:** Matched existing leads to firms by company name and email domain
2. **Connection Requests:** Linked existing requests via user, lead, or manual matching
3. **Agreement Status Sync:** Applied "most permissive" rule to sync statuses between firms and requests

### Phase 6: UI Enhancements

**New Components:**

1. **`LeadFirmBadge`** (`src/components/admin/LeadFirmBadge.tsx`)
   - Shows firm name with agreement status
   - Displays green checkmark if agreements are signed
   - Tooltip with full firm details
   - Used in: Inbound Leads Table

2. **`ConnectionRequestFirmBadge`** (`src/components/admin/ConnectionRequestFirmBadge.tsx`)
   - Shows firm name with member count
   - Agreement status indicators
   - Tooltip with detailed info
   - Used in: Connection Requests Table

3. **`DealFirmWarning`** (`src/components/admin/pipeline/DealFirmWarning.tsx`)
   - Alert shown in Pipeline Documents tab
   - Warns admin before cascading changes to firm
   - Shows member count and firm name
   - Displayed when toggling agreements

**New Hooks:**

1. **`useInboundLeadFirm`** (`src/hooks/admin/use-inbound-lead-firm.ts`)
   - Fetches firm info for a specific lead
   - Returns: firm_id, firm_name, agreement statuses

2. **`useConnectionRequestFirm`** (`src/hooks/admin/use-connection-request-firm.ts`)
   - Fetches firm info for a connection request
   - Returns: firm_id, firm_name, member_count, agreement statuses

**Updated Components:**
- `CompactLeadCard` - Now shows firm badge
- `ConnectionRequestsTable` - Now shows firm badge in request cards
- `PipelineDetailDocuments` - Shows firm warning before agreement updates

---

## 🔄 How It Works

### Scenario 1: Manual Lead Import

```
1. Admin imports CSV with lead: "John Doe, john@acme.com, Acme Corp"
2. Trigger auto_link_lead_to_firm() fires
3. System searches for firm matching "Acme Corp" or "acme.com"
4. If found → lead.firm_id = existing_firm.id
5. If not found → creates new firm "Acme Corp" → lead.firm_id = new_firm.id
```

### Scenario 2: Lead Conversion to Connection Request

```
1. Admin converts lead to connection request
2. Trigger sync_connection_request_firm() fires
3. Gets firm_id from inbound_lead.firm_id
4. Inherits firm's agreement status (if any)
5. Connection request now linked to same firm
```

### Scenario 3: Pipeline Agreement Update (The Magic)

```
1. Admin toggles "NDA Signed" in Pipeline → Documents tab
2. DealFirmWarning shows: "Acme Corp has 5 members. This will cascade to all."
3. Admin confirms toggle
4. update_lead_nda_status() fires:
   - Gets firm_id from connection_request
   - Calls update_nda_firm_status(firm_id, true)
   - Cascades to:
     ✓ All 5 firm members in profiles table
     ✓ All connection requests from those members
     ✓ All deals linked to those requests
5. Realtime updates broadcast changes
6. All admin dashboards refresh instantly
```

### Scenario 4: Marketplace Registration After Lead

```
1. "Jane Smith" from Acme Corp registers on marketplace
2. auto_link_user_to_firm() matches her to existing "Acme Corp" firm
3. She inherits firm's agreement status:
   - John (lead) had NDA signed in pipeline
   - Jane (marketplace) now shows NDA signed
4. Single source of truth: the firm record
```

---

## 🎯 Business Logic Rules

### Firm Matching Priority

1. **Normalized company name** (highest priority)
   - "Acme Corporation" = "Acme Corp" = "ACME CORP"
   - Uses `normalize_company_name()` function

2. **Email domain** (medium priority)
   - john@acme.com → matches firm with email_domain = "acme.com"
   - Excludes generic domains (Gmail, Yahoo, etc.)

3. **Website domain** (lowest priority)
   - Used as fallback for firm matching

### Agreement Status Inheritance

**"Most Permissive" Rule:**
- If EITHER firm OR individual has signed → status = signed
- This prevents losing signed agreements during automatic matching
- Example:
  - Lead has NDA signed in pipeline
  - Later matched to firm without NDA
  - Result: Firm gets updated to NDA signed (not the reverse)

### Generic Email Domain Handling

**Excluded Domains:**
gmail.com, yahoo.com, hotmail.com, outlook.com, icloud.com, aol.com, mail.com, protonmail.com

**Behavior:**
- Leads with generic domains → firm_id = NULL (unless company name matches)
- No automatic firm creation for generic domains
- Prevents grouping unrelated consultants/individuals

---

## 🔧 Admin Workflows

### Viewing Firm Context

**In Inbound Leads Table:**
- Firm badge shows below lead details
- Click badge → navigates to Firm Agreements page
- Tooltip shows agreement status

**In Connection Requests Table:**
- Firm badge appears next to status badges
- Shows member count in parentheses
- Green checkmark if agreements signed

**In Pipeline:**
- Warning alert appears when firm exists
- Shows member count before cascading changes

### Managing Agreements

**Firm-Level (Firm Agreements Page):**
- Toggle applies to all firm members
- Use when: managing established firms

**Individual Level (Pipeline Documents Tab):**
- Toggle now cascades to firm if detected
- Use when: managing specific deals
- Warning shows impact before action

### Handling Duplicates

**Scenario:** Two firms created for same company

**Solution:**
1. Use existing "Merge Firms" tool in Firm Agreements page
2. System will:
   - Combine all members
   - Merge agreement history
   - Update all leads/requests
   - Preserve most recent agreement status

---

## 📊 Database Functions Reference

### Core Functions

**`auto_link_lead_to_firm()`**
- **Trigger:** BEFORE INSERT OR UPDATE on `inbound_leads`
- **Purpose:** Automatically link leads to firms
- **Returns:** Modified NEW record with firm_id set

**`sync_connection_request_firm()`**
- **Trigger:** BEFORE INSERT OR UPDATE on `connection_requests`
- **Purpose:** Inherit firm and agreement status
- **Returns:** Modified NEW record with firm_id and agreements set

**`update_lead_fee_agreement_status(p_request_id, p_value)`**
- **RPC:** Can be called from frontend
- **Purpose:** Update fee agreement with firm cascading
- **Parameters:**
  - `p_request_id`: UUID of connection request
  - `p_value`: TRUE to mark signed, FALSE to mark unsigned

**`update_lead_nda_status(p_request_id, p_value)`**
- **RPC:** Can be called from frontend
- **Purpose:** Update NDA with firm cascading
- **Parameters:** Same as fee agreement

### Helper Functions (Existing)

**`normalize_company_name(text)`**
- Removes punctuation, converts to lowercase
- Used for fuzzy company name matching

**`extract_domain(email)`**
- Extracts domain from email address
- Used for email domain matching

**`update_fee_agreement_firm_status(firm_id, is_signed, signed_by, signed_by_name)`**
- Updates firm fee agreement
- Cascades to all members and their requests

**`update_nda_firm_status(firm_id, is_signed, signed_by, signed_by_name)`**
- Updates firm NDA
- Cascades to all members and their requests

---

## 🧪 Testing the Implementation

### Test Case 1: New Lead Auto-Linking

```sql
-- Create a test lead
INSERT INTO inbound_leads (name, email, company_name, source)
VALUES ('Test User', 'test@testcorp.com', 'Test Corporation', 'manual');

-- Verify firm was created/linked
SELECT 
  l.name, 
  l.company_name,
  f.primary_company_name,
  l.firm_id
FROM inbound_leads l
LEFT JOIN firm_agreements f ON l.firm_id = f.id
WHERE l.email = 'test@testcorp.com';
```

### Test Case 2: Agreement Status Cascade

```sql
-- Toggle fee agreement in pipeline (use admin UI)
-- Then verify cascade:
SELECT 
  f.primary_company_name,
  f.fee_agreement_signed,
  COUNT(fm.user_id) as member_count,
  COUNT(CASE WHEN p.fee_agreement_signed THEN 1 END) as members_with_agreement
FROM firm_agreements f
LEFT JOIN firm_members fm ON f.id = fm.firm_id
LEFT JOIN profiles p ON fm.user_id = p.id
WHERE f.primary_company_name = 'Test Corporation'
GROUP BY f.id, f.primary_company_name, f.fee_agreement_signed;
```

### Test Case 3: Realtime Updates

1. Open Firm Agreements page in two browser tabs (as different admins)
2. In tab 1: Toggle NDA for a firm
3. In tab 2: Verify instant update (no refresh needed)

---

## 🚨 Important Considerations

### Performance

- **Indexes created** on firm_id columns for fast lookups
- **Batch operations** in triggers use single queries
- **Cascade updates** optimized with RPC functions
- **Realtime listeners** invalidate only affected queries

### Data Integrity

- **Foreign keys** enforce referential integrity
- **Triggers** maintain automatic linking
- **Audit logs** track all firm changes
- **Rollback capability** via Supabase migrations

### Edge Cases Handled

1. **Generic email domains** → No automatic firm creation
2. **Missing company names** → Uses email domain as fallback
3. **Conflicting agreements** → Most permissive rule applies
4. **Duplicate firms** → Admin can merge manually
5. **NULL firm_id** → Falls back to individual user updates

---

## 📝 Monitoring & Debugging

### Check Firm Linkage

```sql
-- See which leads have firms
SELECT 
  COUNT(*) as total_leads,
  COUNT(firm_id) as leads_with_firms,
  COUNT(*) - COUNT(firm_id) as leads_without_firms
FROM inbound_leads;
```

### View Firm Agreement Cascade

```sql
-- See firm → members → requests → deals chain
SELECT 
  f.primary_company_name,
  f.fee_agreement_signed as firm_fee,
  p.email as member_email,
  p.fee_agreement_signed as member_fee,
  cr.id as request_id,
  cr.lead_fee_agreement_signed as request_fee,
  d.fee_agreement_status as deal_fee
FROM firm_agreements f
LEFT JOIN firm_members fm ON f.id = fm.firm_id
LEFT JOIN profiles p ON fm.user_id = p.id
LEFT JOIN connection_requests cr ON p.id = cr.user_id OR cr.firm_id = f.id
LEFT JOIN deals d ON cr.id = d.connection_request_id
WHERE f.primary_company_name = 'Your Firm Name'
ORDER BY p.email;
```

### Recent Firm Activity

```sql
-- View recent firm-related changes
SELECT 
  f.primary_company_name,
  f.updated_at,
  f.fee_agreement_signed,
  f.nda_signed,
  (SELECT COUNT(*) FROM firm_members WHERE firm_id = f.id) as members
FROM firm_agreements f
ORDER BY f.updated_at DESC
LIMIT 20;
```

---

## 🎓 Best Practices

### For Admins

1. **Review firm warnings** before toggling agreements in pipeline
2. **Check Firm Agreements page** to see full member list
3. **Use firm-level toggles** for established firms with multiple members
4. **Use pipeline toggles** for one-off deals or individual contacts
5. **Merge duplicate firms** as soon as you spot them

### For Developers

1. **Always invalidate firm-related queries** after mutations
2. **Use TypeScript types** from the new hooks
3. **Test cascade behavior** before deploying agreement changes
4. **Monitor Supabase logs** for trigger execution
5. **Use the "most permissive" rule** when in doubt about status conflicts

---

## 🚀 Future Enhancements

### Potential Improvements

1. **Firm Analytics Dashboard**
   - Show lead → conversion → deal funnel per firm
   - Track which firms have highest engagement
   - Display agreement completion rates

2. **Smart Duplicate Detection**
   - AI-powered company name matching
   - Suggest merges proactively
   - Flag potential duplicates on import

3. **Bulk Agreement Management**
   - Send agreements to entire firm at once
   - Track which members have opened emails
   - Automated reminders for unsigned agreements

4. **Firm Health Scores**
   - Calculate based on members, agreements, deals
   - Prioritize high-value firms
   - Flag at-risk relationships

---

## ✅ Deployment Checklist

- [x] Database migration executed successfully
- [x] All triggers created and tested
- [x] RPC functions updated with cascading logic
- [x] Realtime publication configured
- [x] Frontend hooks implemented
- [x] UI components added
- [x] Data backfilled for existing records
- [x] Firm badges visible in all relevant tables
- [x] Warning alerts working in pipeline
- [x] Testing completed across all scenarios

---

## 📞 Support

For questions or issues:
1. Check this documentation first
2. Review Supabase migration logs
3. Test with sample data in development
4. Contact development team if issues persist

**Migration File:** `20251027-112828-203548.sql`
**Implementation Date:** October 27, 2025
**Status:** ✅ Production Ready
