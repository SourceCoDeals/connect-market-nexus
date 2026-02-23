# Smoke Test Checklist ✅

After implementing the profile standardization and Investment Fit fixes, run through these critical flows:

## 🔥 New User Signup Flow
- [ ] Choose buyer type (corporate/PE/family office/search fund/individual)
- [ ] Select categories from standardized list
- [ ] Select locations from standardized list  
- [ ] Set revenue range using $1M-$5M style in CurrencyInput
- [ ] **Verify**: Profile row auto-created in database (trigger working)
- [ ] **Verify**: Fields persisted correctly as arrays and numbers
- [ ] **Check**: `target_locations` is JSONB array, not string

## 🎯 Investment Fit Analysis
- [ ] **With sparse profile**: Score shows 0/"No Match" for incomplete profiles (<40%)
- [ ] **After profile completion**: Add categories, locations, revenue range in Profile page
- [ ] **Verify**: Score moves meaningfully based on listing matches
- [ ] **Check**: Exact matches return higher scores (80%+)
- [ ] **Verify**: Revenue range displays correctly (no "Infinity" shown)

## 👤 Profile Updates
- [ ] Update revenue range via CurrencyInput components
- [ ] **Verify**: Data saved as numbers in database (not strings)
- [ ] **Check**: `target_locations` remains an array after updates
- [ ] **Verify**: Business categories remain as arrays

## 🤝 Connection Requests
- [ ] Request connection to a listing
- [ ] **Verify**: Request stored and visible in "My Requests"
- [ ] **Check**: Request appears in admin dashboard

## 💾 Saved Listings
- [ ] Save/unsave listings
- [ ] **Verify**: Records persist correctly in database
- [ ] **Check**: Saved listings appear in "Saved Listings" page

## 🔐 Password Flows
- [ ] Use "Forgot Password" (should use Brevo emails only)
- [ ] **Verify**: Reset email arrives and works
- [ ] **Check**: Reset password UI shows requirements with live validation
- [ ] **Verify**: Password reset succeeds

## 🎨 UI/UX Checks
- [ ] **Dropdowns**: No transparency issues (z-50 applied)
- [ ] **Currency inputs**: Show $ symbol, commas, M/K/B friendly
- [ ] **Validation**: At least one category and location required in signup
- [ ] **Revenue validation**: Min < Max when both provided

## 🔍 Admin Verification
- [ ] Check new user profiles in admin dashboard
- [ ] **Verify**: All fields populated correctly as expected types
- [ ] **Check**: Connection requests show user and listing data
- [ ] **Verify**: No RLS violations or missing data

---

## DocuSeal NDA Webhook End-to-End Test (Post-Audit)

**Status:** TODO — implement as admin panel test page at `/admin/settings/docuseal-test`
**Priority:** Post-audit
**Purpose:** Verify the full DocuSeal webhook pipeline works end-to-end: submission creation, webhook receipt, and database field updates.

### Prerequisites
- DocuSeal API key configured (`DOCUSEAL_API_KEY`)
- NDA template configured (`DOCUSEAL_NDA_TEMPLATE_ID`)
- Webhook secret configured (`DOCUSEAL_WEBHOOK_SECRET`)
- Webhook URL registered in DocuSeal dashboard pointing to `docuseal-webhook-handler`

### Steps

1. **Pick a test firm**
   - Select a safe `firm_agreements` row from the database (or create a dummy firm: `primary_company_name = "QA Test Firm"`)
   - Note the `firm_id`

2. **Create a DocuSeal submission via API** (`send_email: false`)
   - Call the `create-docuseal-submission` edge function with:
     ```json
     {
       "firmId": "<firm_id>",
       "documentType": "nda",
       "signerEmail": "qa-test@sourceco-test.local",
       "signerName": "QA Test Signer",
       "deliveryMode": "embedded"
     }
     ```
   - `send_email: false` is implicit in `deliveryMode: "embedded"` (no email sent)
   - Confirm the response includes `submissionId` and `embedSrc`
   - Confirm `firm_agreements.nda_docuseal_submission_id` is set
   - Confirm `firm_agreements.nda_docuseal_status` = `"pending"`

3. **Trigger the webhook** (mark submission complete in DocuSeal dashboard)
   - In the DocuSeal admin dashboard, find the test submission
   - Use the demo/test complete option to mark it as completed
   - DocuSeal fires the `form.completed` webhook to our `docuseal-webhook-handler` endpoint

4. **Verify the five database fields**

   Query `firm_agreements` for the test firm and confirm:

   | Field | Expected Value |
   |-------|---------------|
   | `nda_signed` | `true` |
   | `nda_signed_at` | Non-null timestamp |
   | `nda_docuseal_status` | `"completed"` |
   | `nda_signed_document_url` | Non-null HTTPS URL |

   Query `docuseal_webhook_log` and confirm:

   | Field | Expected Value |
   |-------|---------------|
   | `event_type` | `"form.completed"` |
   | `submission_id` | Matches the submission ID from step 2 |
   | `raw_payload` | Contains the full webhook payload |

5. **Cleanup**
   - Reset test firm's NDA fields to original state
   - Or delete the dummy firm if one was created

### Implementation Notes
- Build as an interactive admin page similar to `SystemTestRunner.tsx`
- Step 3 (marking complete in DocuSeal dashboard) is manual — the test page should poll `firm_agreements` after step 2 and display live status updates as the webhook fires
- Show clear pass/fail for each of the 5 verification checks
- Include a "Create Test Firm" button that inserts a dummy `firm_agreements` row
- Include a "Cleanup" button that resets/removes test data

---

**Target State**: All flows work seamlessly with standardized data types, accurate Investment Fit scoring, and clean profile management.