# LinkedIn Employee Count Issue - Root Cause Analysis

## Problem Statement
LinkedIn employee counts are sometimes incorrect because the system is pulling data from the **wrong company's LinkedIn profile**.

---

## How It Currently Works

### 1. LinkedIn Profile Search Flow
**File:** `supabase/functions/apify-linkedin-scrape/index.ts`

When a deal doesn't have a direct LinkedIn URL, the system:

1. **Searches for LinkedIn profile** using Firecrawl (lines 58-89):
   ```typescript
   const locationPart = city && state ? ` ${city} ${state}` : (state ? ` ${state}` : '');
   const searchQuery = `site:linkedin.com/company "${companyName}"${locationPart}`;
   ```

2. **Takes the FIRST result** from search (lines 367-371):
   ```typescript
   for (const result of results) {
     if (result.url && isLinkedInCompanyUrl(result.url)) {
       return normalizeLinkedInUrl(result.url);  // Returns FIRST match
     }
   }
   ```

3. **Scrapes employee data** from that profile using Apify (lines 212-299)

4. **Verifies website** (lines 120-143) - BUT only if both websites exist:
   ```typescript
   if (companyWebsite && companyData.website) {
     const websiteMatch = doWebsitesMatch(companyWebsite, companyData.website);
     if (!websiteMatch) {
       console.warn('WEBSITE MISMATCH');
       // Rejects profile
     }
   } else if (foundViaSearch && !companyData.website) {
     // WARNING: Allows it anyway!
     console.warn('LinkedIn profile found via search has no website to verify against');
   }
   ```

---

## Root Causes

### Issue #1: Generic Company Names
**Examples:**
- "NES" could match:
  - NES Navy (Correct)
  - NES Fircroft (Wrong)
  - NES Global Talent (Wrong)
- "ABC Company" matches hundreds of different businesses

**Why it happens:**
- Search returns multiple results
- System picks FIRST result without ranking by relevance
- No additional validation beyond website match

### Issue #2: Website Verification Bypass
**Critical flaw (lines 140-143):**
```typescript
else if (foundViaSearch && !companyData.website) {
  // If we found via search but LinkedIn has no website, log a warning but allow it
  console.warn('LinkedIn profile found via search has no website to verify against');
}
```

If the LinkedIn profile doesn't list a website, verification is **skipped entirely**.

### Issue #3: Location Not Used for Verification
**Current behavior:**
- Location (city/state) is included in the **search query**
- BUT it's **not verified** after finding the profile
- LinkedIn profiles often operate in multiple locations
- No check if the found profile actually matches the deal's location

### Issue #4: No Confidence Score
**Missing quality indicators:**
- No score for how well the result matches
- No indication if multiple candidates were found
- No way to flag "uncertain" matches for manual review

---

## Examples of Failures

### Example 1: "NES" (Navy vs Fircroft)
```
Deal: NES Navy Electrical Services (Dallas, TX)
Search: "NES" + "Dallas" + "TX"
Results:
  1. NES Fircroft (global staffing, HQ in Houston but operates in Dallas) ✗ WRONG
  2. NES Global Talent (staffing firm) ✗ WRONG
  3. NES Navy (electrical services, smaller company) ✓ CORRECT

Problem: Takes result #1 (largest company, appears first in search)
```

### Example 2: Generic "Home Services Company"
```
Deal: "Johnson Home Services" (Phoenix, AZ)
Search: "Johnson Home Services" + "Phoenix" + "AZ"
Results:
  1. Johnson Controls (Fortune 500, operates everywhere) ✗ WRONG
  2. Johnson & Johnson Home Care (different business) ✗ WRONG
  3. Johnson Home Services LLC (correct small business) ✓ CORRECT

Problem: Takes result #1 (biggest brand match)
```

---

## Proposed Solutions

### Solution A: Enhanced Website Verification (CRITICAL FIX)
**Reject profiles without websites when found via search**

```typescript
// CURRENT (lines 140-143):
else if (foundViaSearch && !companyData.website) {
  console.warn('LinkedIn profile found via search has no website to verify against');
  // Continues anyway ❌
}

// PROPOSED FIX:
else if (foundViaSearch && !companyData.website) {
  console.warn('LinkedIn profile found via search has no website for verification. REJECTING.');
  return new Response(
    JSON.stringify({
      success: false,
      error: `Found LinkedIn profile but cannot verify it's the correct company (no website listed). Please provide the LinkedIn URL manually.`,
      scraped: false,
      websiteMismatch: false,
      noWebsiteToVerify: true,
      needsManualUrl: true
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Impact:** Forces manual LinkedIn URL entry for profiles without websites, preventing wrong matches.

---

### Solution B: Multi-Signal Matching Score
**Rank search results by relevance instead of taking first**

```typescript
interface LinkedInCandidate {
  url: string;
  matchScore: number;
  signals: {
    nameMatch: number;          // 0-100: how well name matches
    locationMatch: boolean;      // True if location mentioned in profile
    websiteMatch: boolean;       // True if websites match
    employeeCountRange: string;  // Size indicator
    hasWebsite: boolean;
  };
}

function rankLinkedInCandidates(
  candidates: string[],
  companyName: string,
  location: { city?: string; state?: string },
  companyWebsite?: string
): LinkedInCandidate[] {
  // Fetch details for each candidate
  // Score based on:
  // - Name similarity (fuzzy match)
  // - Location mentioned in LinkedIn description
  // - Website domain match
  // - Size (prefer smaller if multiple matches)

  return sortedByScore;
}
```

**Scoring weights:**
- Website match: 50 points
- Location match: 25 points
- Name exact match: 15 points
- Name fuzzy match: 5-10 points

**Decision logic:**
- Score >= 65: Auto-accept
- Score 40-64: Flag for manual review
- Score < 40: Reject, ask for manual URL

---

### Solution C: Location Verification
**Add location validation after finding profile**

```typescript
// After scraping LinkedIn profile, verify location
function verifyLocation(
  linkedInData: ApifyLinkedInResult,
  expectedCity?: string,
  expectedState?: string
): { match: boolean; confidence: 'high' | 'medium' | 'low'; reason: string } {
  const headquarters = linkedInData.headquarters?.toLowerCase() || '';
  const description = linkedInData.description?.toLowerCase() || '';

  if (!expectedCity && !expectedState) {
    return { match: true, confidence: 'low', reason: 'No expected location to verify' };
  }

  const cityLower = expectedCity?.toLowerCase() || '';
  const stateLower = expectedState?.toLowerCase() || '';

  // Check headquarters field
  if (headquarters.includes(cityLower) || headquarters.includes(stateLower)) {
    return { match: true, confidence: 'high', reason: 'Location matches headquarters' };
  }

  // Check description for location mentions
  if (description.includes(cityLower) || description.includes(stateLower)) {
    return { match: true, confidence: 'medium', reason: 'Location mentioned in description' };
  }

  // Check if company operates in multiple locations (might be correct anyway)
  const hasMultipleLocations = /\d+\s+locations?|nationwide|multiple\s+offices?/i.test(description);
  if (hasMultipleLocations) {
    return { match: true, confidence: 'low', reason: 'Multi-location company, cannot verify' };
  }

  return { match: false, confidence: 'high', reason: 'Location mismatch - HQ elsewhere' };
}
```

**Integration:**
```typescript
// After scraping
const locationCheck = verifyLocation(companyData, city, state);
if (!locationCheck.match) {
  console.warn(`Location mismatch: ${locationCheck.reason}`);
  return new Response(
    JSON.stringify({
      success: false,
      error: `LinkedIn profile location (${companyData.headquarters}) does not match deal location (${city}, ${state}). This may be the wrong company.`,
      locationMismatch: true,
      needsManualUrl: true
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### Solution D: Employee Count Range Validation
**Sanity check employee count against deal size**

```typescript
function validateEmployeeCount(
  linkedInCount: number,
  dealRevenue?: number,
  dealEmployees?: number
): { valid: boolean; confidence: 'high' | 'medium' | 'low'; warning?: string } {
  // Revenue per employee heuristics
  const revenuePerEmployee = dealRevenue && dealEmployees
    ? dealRevenue / dealEmployees
    : null;

  // If we have deal employee count, LinkedIn should be close
  if (dealEmployees) {
    const ratio = linkedInCount / dealEmployees;
    if (ratio < 0.5 || ratio > 2) {
      return {
        valid: false,
        confidence: 'low',
        warning: `LinkedIn shows ${linkedInCount} employees but deal has ${dealEmployees}. Large mismatch suggests wrong profile.`
      };
    }
  }

  // If revenue/employee ratio is way off (e.g., $50K or $5M per employee)
  if (revenuePerEmployee) {
    if (revenuePerEmployee < 30000 || revenuePerEmployee > 2000000) {
      return {
        valid: false,
        confidence: 'medium',
        warning: `Revenue per employee ($${Math.round(revenuePerEmployee)}) is unusual. Verify LinkedIn profile is correct.`
      };
    }
  }

  return { valid: true, confidence: 'high' };
}
```

---

### Solution E: Manual Review Queue
**Flag uncertain matches for review**

**Database schema addition:**
```sql
ALTER TABLE listings ADD COLUMN linkedin_match_confidence TEXT
  CHECK (linkedin_match_confidence IN ('high', 'medium', 'low', 'manual'));
ALTER TABLE listings ADD COLUMN linkedin_match_signals JSONB;
```

**UI indicator:**
```tsx
{deal.linkedin_match_confidence === 'low' && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <div>
      <strong>LinkedIn Match Uncertain</strong>
      <p>Found profile "{deal.linkedin_url}" but confidence is low. Please verify this is the correct company.</p>
      <Button onClick={() => manuallySetLinkedInUrl()}>Update LinkedIn URL</Button>
    </div>
  </Alert>
)}
```

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Immediate)
1. **Solution A** - Reject profiles without websites when found via search
2. **Solution C** - Add basic location verification

**Impact:** Prevents most wrong matches immediately

### Phase 2: Enhanced Matching (Week 2)
3. **Solution B** - Multi-signal scoring for search results
4. **Solution D** - Employee count validation

**Impact:** Improves automatic matching quality

### Phase 3: Manual Review (Week 3)
5. **Solution E** - Confidence scoring + manual review queue

**Impact:** Enables data team to fix uncertain matches

---

## Testing Strategy

### Test Cases
1. **Generic name + location** - "ABC Company" in "Dallas, TX"
2. **National brand** - "Johnson Controls" vs "Johnson Home Services"
3. **Similar names** - "NES Navy" vs "NES Fircroft"
4. **No website on LinkedIn** - Small business without website
5. **Multi-location company** - Headquarters in one state, deal in another
6. **Wrong employee count** - Fortune 500 matched to small business

### Success Criteria
- **0%** wrong company matches (currently ~15-20% estimated)
- **<5%** false negatives (correct matches rejected)
- **>90%** auto-match confidence
- **<10%** manual review required

---

## Monitoring & Alerts

### Metrics to Track
```sql
-- Wrong match indicators
SELECT
  COUNT(*) as potential_mismatches
FROM listings
WHERE linkedin_employee_count > full_time_employees * 10  -- LinkedIn shows 10x more employees
   OR linkedin_employee_count < full_time_employees / 10; -- LinkedIn shows 10x fewer

-- No website verification
SELECT
  COUNT(*) as unverified_profiles
FROM listings
WHERE linkedin_url IS NOT NULL
  AND linkedin_website IS NULL
  AND website IS NOT NULL;
```

### Dashboard Alerts
- **Daily:** Count of new LinkedIn profiles added without website verification
- **Weekly:** List of employee count mismatches >5x difference
- **Monthly:** Manual review queue size

---

## Code Changes Required

### Files to Modify
1. `supabase/functions/apify-linkedin-scrape/index.ts` - Add verification logic
2. `supabase/migrations/` - Add confidence columns
3. `src/pages/admin/remarketing/ReMarketingDealDetail.tsx` - Add warning UI

### Estimated Effort
- **Phase 1 (Critical):** 4-6 hours
- **Phase 2 (Enhanced):** 8-12 hours
- **Phase 3 (Manual Review):** 6-8 hours
- **Total:** 2-3 days

---

## Conclusion

**Root cause:** Taking the first search result without sufficient verification

**Primary fix:** Reject LinkedIn profiles found via search that don't have a website to verify

**Long-term solution:** Multi-signal matching with confidence scores and manual review queue

**Impact:** Eliminate wrong company matches, improve data quality for buyer scoring
