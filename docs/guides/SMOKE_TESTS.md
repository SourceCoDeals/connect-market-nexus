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

**Target State**: All flows work seamlessly with standardized data types, accurate Investment Fit scoring, and clean profile management.