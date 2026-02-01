
# Intelligence Center Enhancement: 3rd-Party Data Integration

## Executive Summary

After 2 days of data collection, your 3rd-party analytics tools are **tracking visitors client-side**, but the most valuable data (B2B company identification from RB2B/Warmly) is NOT flowing into your Intelligence Center. This plan adds webhook receivers to capture company identification data and surfaces it in a new "Visitor Companies" dashboard.

---

## What Data is Available Now vs. What's Missing

| Data Source | Currently Captured | Missing (Needs Integration) |
|-------------|-------------------|----------------------------|
| **RB2B** | Client tracking only | Company name, industry, employee count, revenue, visitor LinkedIn profile, job title |
| **Warmly** | Client tracking only | Same as RB2B + tech stack, social handles, intent signals |
| **GA4** | Not synced server-side | Cross-domain user journeys, session attribution |
| **Heap** | Client tracking only | Session replays, behavioral funnels (requires Heap Connect) |
| **Hotjar** | Client tracking only | Session recordings (requires Business plan API) |
| **Brevo** | Email delivery logs | Open/click tracking (already have via edge functions) |

---

## Implementation Plan

### Phase 1: RB2B & Warmly Webhook Integration (High Value)

Both RB2B and Warmly offer webhook endpoints that POST company identification data when they identify a visitor. This is the highest-value data to capture.

**Step 1.1: Create Database Table**

```sql
CREATE TABLE visitor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Visitor identification
  session_id TEXT,
  captured_url TEXT,
  seen_at TIMESTAMPTZ,
  referrer TEXT,
  
  -- Person data (from RB2B/Warmly)
  linkedin_url TEXT,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  business_email TEXT,
  
  -- Company data
  company_name TEXT,
  company_website TEXT,
  company_industry TEXT,
  company_size TEXT,  -- "1-10", "11-50", "51-200", etc.
  estimated_revenue TEXT,
  company_city TEXT,
  company_state TEXT,
  company_country TEXT,
  
  -- Metadata
  source TEXT CHECK (source IN ('rb2b', 'warmly', 'manual')),
  is_repeat_visit BOOLEAN DEFAULT FALSE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_visitor_companies_company ON visitor_companies(company_name);
CREATE INDEX idx_visitor_companies_seen_at ON visitor_companies(seen_at DESC);
CREATE INDEX idx_visitor_companies_source ON visitor_companies(source);
```

**Step 1.2: Create Edge Function Webhook Receiver**

Create `supabase/functions/webhook-visitor-identification/index.ts`:

```typescript
// Receives webhooks from RB2B and Warmly
// POST /webhook-visitor-identification?source=rb2b

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const source = url.searchParams.get('source') || 'unknown';
  const payload = await req.json();
  
  // Normalize RB2B/Warmly payload to common schema
  const visitorData = {
    linkedin_url: payload['LinkedIn URL'],
    first_name: payload['First Name'],
    last_name: payload['Last Name'],
    job_title: payload['Title'],
    business_email: payload['Business Email'],
    company_name: payload['Company Name'],
    company_website: payload['Website'],
    company_industry: payload['Industry'],
    company_size: payload['Employee Count'],
    estimated_revenue: payload['Estimate Revenue'],
    company_city: payload['City'],
    company_state: payload['State'],
    captured_url: payload['Captured URL'],
    referrer: payload['Referrer'],
    seen_at: payload['Seen At'],
    is_repeat_visit: payload['is_repeat_visit'] || false,
    source: source,
    raw_payload: payload
  };
  
  // Insert into database
  await supabase.from('visitor_companies').insert(visitorData);
  
  return new Response(JSON.stringify({ success: true }));
}
```

**Step 1.3: Configure RB2B & Warmly Webhooks**

In RB2B Dashboard (app.rb2b.com/integrations/webhook):
```
URL: https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=rb2b
```

In Warmly Dashboard (opps.getwarmly.com/settings → Webhooks):
```
URL: https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=warmly
```

---

### Phase 2: New Intelligence Center Tab - "Visitor Companies"

**Step 2.1: Create Dashboard Component**

```
src/components/admin/analytics/companies/
├── VisitorCompaniesDashboard.tsx    # Main dashboard
├── CompanyIdentificationCard.tsx     # Single company card
├── TopCompaniesTable.tsx             # Ranked list of visiting companies
├── IndustryBreakdownChart.tsx        # Pie chart of visitor industries
└── CompanySizeDistribution.tsx       # Bar chart of company sizes
```

**Dashboard Features:**
- **Live Feed**: Real-time stream of identified visitors with company/title
- **Top Visiting Companies**: Ranked by visit frequency
- **Industry Breakdown**: Pie chart showing which industries are browsing
- **Company Size Distribution**: SMB vs Mid-Market vs Enterprise visitors
- **Hot Leads Panel**: Visitors who viewed multiple listings or pricing pages
- **Visitor Timeline**: Individual visitor journey with all pages viewed

**Step 2.2: Add Tab to Intelligence Center**

Add new "Companies" tab to AnalyticsTabContainer.tsx with Building2 icon.

---

### Phase 3: Enhance Existing Tabs with Company Data

**3.1: Real-Time Tab Enhancement**
- Show company name + logo next to active visitor dots on globe
- Add "Identified" badge to known visitors in live feed
- Display job title in hover tooltip

**3.2: Buyer Intent Tab Enhancement**
- Cross-reference identified visitors with your remarketing_buyers table
- Show "Known Buyer" badge for visitors matching PE firms
- Alert when high-value prospects are browsing

**3.3: Traffic Tab Enhancement**
- Add "Company Attribution" section showing traffic by company
- Show company industry breakdown in traffic sources

---

### Phase 4: GA4 Server-Side Integration (Optional - Requires GCP Setup)

To pull GA4 data server-side, you would need:
1. Create GCP Service Account with Analytics Data API access
2. Add service account JSON credentials as Supabase secret
3. Create edge function using `@google-analytics/data` package
4. Build scheduled job to sync daily metrics

This is more complex and may not be necessary since you already have good session tracking in Supabase.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_visitor_companies.sql` | Create | New table for company identification data |
| `supabase/functions/webhook-visitor-identification/index.ts` | Create | Webhook receiver for RB2B/Warmly |
| `src/components/admin/analytics/companies/VisitorCompaniesDashboard.tsx` | Create | Main companies dashboard |
| `src/components/admin/analytics/companies/TopCompaniesTable.tsx` | Create | Ranked companies table |
| `src/components/admin/analytics/companies/CompanyCard.tsx` | Create | Individual company card |
| `src/hooks/useVisitorCompanies.ts` | Create | Data fetching hook |
| `src/components/admin/analytics/AnalyticsTabContainer.tsx` | Modify | Add "Companies" tab |
| `src/components/admin/analytics/realtime/LiveActivityFeed.tsx` | Modify | Show company name for identified visitors |
| `src/integrations/supabase/types.ts` | Auto-update | Types for new table |

---

## External Configuration Required (Your Action)

After implementation, you need to configure webhooks in external platforms:

1. **RB2B** (app.rb2b.com → Integrations → Webhook):
   - URL: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=rb2b`
   - Enable "Sync company-only profiles"
   - Consider enabling "Send repeat visitor data"

2. **Warmly** (opps.getwarmly.com → Settings → Webhooks):
   - URL: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/webhook-visitor-identification?source=warmly`

---

## Expected Outcome

After implementation:

1. **New Data Captured**: Every visitor RB2B/Warmly identifies will be stored with:
   - LinkedIn profile URL
   - Name and job title
   - Company name, size, industry, revenue
   - Pages they visited

2. **New Dashboard**: "Visitor Companies" tab showing:
   - Which PE firms and strategics are browsing your marketplace
   - What industries are most interested
   - Individual visitor timelines

3. **Enhanced Real-Time**: Live feed will show company names and job titles for identified visitors

4. **Lead Intelligence**: You'll know when a Managing Director at a $5B PE firm is browsing your listings

---

## Priority Order

| Priority | Task | Value | Effort |
|----------|------|-------|--------|
| 1 | RB2B/Warmly webhook integration | Very High | Medium |
| 2 | Visitor Companies dashboard | Very High | Medium |
| 3 | Real-time feed enhancement | High | Low |
| 4 | Buyer Intent cross-reference | High | Medium |
| 5 | GA4 server-side sync | Medium | High |

---

## Technical Notes

- RB2B requires Pro plan for webhooks (verify your plan)
- Warmly webhooks are available on free plan
- Webhook payloads are slightly different between providers - edge function normalizes them
- Consider rate limiting on webhook endpoint to prevent abuse
- Store raw_payload JSONB for future field extraction
