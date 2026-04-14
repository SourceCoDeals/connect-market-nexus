# Marketplace Metrics Dashboard — 20 Real-World Scenarios

## Scenario 1: Weekly Exec Review — Are We Growing?

**Who:** CEO (Tomos) in Monday morning standup  
**Goal:** Quick pulse on whether the marketplace is gaining traction

**Steps:**

1. Navigate to Admin Dashboard > Marketplace > Metrics
2. Set timeline to "Last 7 days"
3. Read the 5 hero KPIs: new signups, deals added (EBITDA), connection requests (approved %), requests/deal, meetings
4. Compare mentally to last week (or switch to "Last 30 days" for trend)
5. If signups dropped: click Users tab to see approved vs rejected breakdown
6. If requests/deal dropped: click Connections tab to see if specific deals are underperforming

**Gap found:** No period-over-period comparison (delta % with up/down arrow). Would need prior-period query.

---

## Scenario 2: Board Deck Prep — Quarter in Review

**Who:** CEO preparing quarterly board slides  
**Goal:** Pull Q2 marketplace numbers for investor deck

**Steps:**

1. Set timeline to "Quarter to date"
2. Screenshot hero KPI strip for the deck summary slide
3. Click Deals tab — note total EBITDA added and revenue added
4. Click Users tab — note total signups, approval rate
5. Click Connections tab — note total requests, approval rate, requests/deal
6. Click Meetings tab — note total meetings and hours
7. Change to prior quarter (switch to custom date range for Q1) and note deltas manually

**Gap found:** No CSV export. No prior-period comparison. These would save significant time.

---

## Scenario 3: Seller Quality Check — Is New Deal Inventory Attractive?

**Who:** Head of Marketplace  
**Goal:** Assess whether newly added deals are generating buyer interest

**Steps:**

1. Set timeline to "Last 30 days"
2. Note "Requests per deal" KPI — is it above 2.0 (healthy) or below 1.0 (weak)?
3. Click Deals tab — check EBITDA distribution (are we adding $1M+ EBITDA deals or sub-$500K?)
4. Check deals by industry — are we diversified or concentrated?
5. Click Connections tab — check approval rate. If high requests but low approvals, deals are attracting the wrong buyers.
6. Cross-reference: if 50 deals added but only 30 connection requests, 20 deals have zero interest — investigate those

**Gap found:** No "deals with zero connection requests" filter. Would need a join between listings and connection_requests grouped by listing_id.

---

## Scenario 4: User Approval Backlog — Are We Bottlenecking Growth?

**Who:** Ops team lead  
**Goal:** Ensure user approvals aren't backing up

**Steps:**

1. Set timeline to "Last 7 days"
2. Click Users tab
3. Check "Pending" count — if it's growing week-over-week, the team is falling behind
4. Check approval rate — below 70% might mean bad-fit applications or overly strict criteria
5. Check rejection rate — if it's climbing, marketing might be attracting the wrong audience
6. Switch to "Month to date" — compare pending now vs. start of month

**Gap found:** No "time to approve" metric (avg hours from signup to decision). Would need approval_at timestamp on profiles table. Also no alert when pending queue exceeds a threshold.

---

## Scenario 5: Deal Source Attribution — Where Are Good Deals Coming From?

**Who:** Marketing lead  
**Goal:** Understand which channels bring the best deal inventory

**Steps:**

1. Set timeline to "Last 30 days"
2. Click Deals tab — check deals by industry breakdown
3. Cross-reference with remarketing dashboard source data (CapTarget vs GP Partners vs manual)
4. Note which industries generate the most connection requests (connection tab)
5. Decide where to focus outreach: double down on industries with high requests/deal

**Gap found:** No deal source attribution on this dashboard (listings.lead_source exists but isn't surfaced). No connection-to-industry cross-tab.

---

## Scenario 6: Meeting Conversion Funnel — Are Connections Leading to Meetings?

**Who:** Business development manager  
**Goal:** Track whether approved connections are converting to meetings

**Steps:**

1. Set timeline to "Quarter to date"
2. Note: connection requests approved (Connections tab)
3. Note: meetings held (Meetings tab)
4. Calculate conversion rate: meetings / approved connections
5. If ratio is below 20%, connections aren't converting — investigate why (bad matches? slow follow-up?)
6. Check average meeting length — under 15 min suggests surface-level intro calls, 30+ suggests deep engagement

**Gap found:** No explicit funnel visualization (connection → meeting → LOI → close). Meetings aren't linked to specific connections or deals, so the conversion is estimated, not exact.

---

## Scenario 7: Seasonal Pattern Detection — Is Q4 Always Slow?

**Who:** Strategy team  
**Goal:** Identify seasonal patterns to plan marketing spend

**Steps:**

1. Set timeline to "Last 12 months"
2. Note hero KPIs for the full year
3. Switch to "Quarter to date" and compare Q1 vs Q2 vs Q3 vs Q4 by switching presets and writing down numbers
4. Look for: signup spikes (Jan, Sep), deal addition patterns, connection request seasonality
5. Plan next year's marketing budget based on seasonal demand

**Gap found:** No time-series chart showing trends over time. Current dashboard is point-in-time aggregates only. A line chart per month would make this scenario instant instead of manual switching.

---

## Scenario 8: Marketplace Saturation — Do We Have Enough Buyers for Each Deal?

**Who:** Marketplace strategy  
**Goal:** Assess supply/demand balance

**Steps:**

1. Set timeline to "Year to date"
2. Check hero KPI: requests per deal
3. If < 1.0: buyer shortage (need more buyer acquisition)
4. If > 5.0: seller shortage (need more deals, buyers are competing for limited inventory)
5. Click Users tab — check buyer vs seller signup ratio
6. Click Deals tab — check how many deals are active vs. closed
7. Decision: invest in buyer acquisition or seller acquisition

**Gap found:** No buyer/seller role split on signup counts. profiles.approval_status exists but user_roles breakdown isn't in the dashboard. No active deal count vs. total deal count split.

---

## Scenario 9: Connection Request Quality Audit — Are Rejections Too High?

**Who:** Marketplace operations  
**Goal:** Investigate why connection request rejection rate spiked

**Steps:**

1. Set timeline to "Last 7 days"
2. Click Connections tab — check rejection count and rate
3. If rejection rate > 30%: something changed
4. Switch to "Last 30 days" — was it a sudden spike or gradual trend?
5. Investigate: are specific buyers submitting bulk low-quality requests?
6. Check "requests per deal" — if one deal has 20 requests and 15 rejections, the deal is attracting unqualified buyers
7. Action: tighten buyer matching criteria or update deal qualification requirements

**Gap found:** No per-deal rejection breakdown. No per-buyer request volume. Would need a drill-down from aggregate to individual records.

---

## Scenario 10: New Team Member Onboarding — "Show Me the Dashboard"

**Who:** New operations analyst  
**Goal:** Understand current marketplace state in first week

**Steps:**

1. Navigate to Admin Dashboard > Marketplace > Metrics
2. Set to "Last 30 days" for a representative sample
3. Read hero KPIs — get a mental model of volume (50 signups? 500?)
4. Click each tab: Users, Deals, Connections, Meetings
5. Switch to "Year to date" for the big picture
6. Report back to manager with key observations

**Possible:** Yes, fully supported. The dashboard is self-explanatory.

---

## Scenario 11: Deal Pipeline Health — Is EBITDA Growing or Shrinking?

**Who:** Investment team  
**Goal:** Track whether marketplace deal quality (measured by EBITDA) is improving

**Steps:**

1. Set timeline to "Last 30 days"
2. Click Deals tab — note EBITDA added
3. Switch to "Month to date" — note current month EBITDA
4. Compare: is this month's EBITDA tracking ahead or behind last month?
5. Check deals by status — how many active vs. withdrawn?
6. If EBITDA dropping: check industry breakdown — did a major industry vertical dry up?

**Gap found:** No avg EBITDA per deal metric. No EBITDA trend over time. No deal withdrawal rate.

---

## Scenario 12: Marketing Campaign ROI — Did the Conference Drive Signups?

**Who:** Marketing lead after a trade show  
**Goal:** Measure signup spike from FSPA/RISKWORLD conference

**Steps:**

1. Set timeline to conference week dates (need custom date range)
2. Check hero KPI: new signups
3. Compare to same period last month
4. Click Users tab — check if approved rate is higher (conference leads are usually warmer)
5. Click Connections tab — did the new signups start requesting connections quickly?
6. Verdict: if signups 3x normal and conversion rate held, conference was worth it

**Gap found:** No custom date range picker (only presets). No source attribution to link signups to a specific campaign/event.

---

## Scenario 13: Team Performance Comparison — Which Admin Approves Fastest?

**Who:** Ops manager  
**Goal:** Identify approval bottlenecks by team member

**Steps:**

1. Set timeline to "Last 30 days"
2. Click Connections tab — note overall approval rate and pending count
3. Want to see: which admin handles the most approvals, and how fast

**Gap found:** No per-admin breakdown of connection approvals. The connection_requests table has an admin assignment concept but the dashboard doesn't expose per-admin metrics. This is a significant gap for team management.

---

## Scenario 14: Stale Deal Detection — Which Deals Are Getting No Love?

**Who:** Marketplace curator  
**Goal:** Identify deals that need refreshing or delisting

**Steps:**

1. Set timeline to "Last 30 days"
2. Click Deals tab — note total deals added
3. Click Connections tab — note requests per deal
4. Want to identify: deals added 30+ days ago with zero connection requests
5. Action: refresh listing description, update pricing, or mark as "needs attention"

**Gap found:** No "zero-request deals" list. No deal age vs. engagement correlation. Would need a join: listings LEFT JOIN connection_requests GROUP BY listing showing deals with count = 0.

---

## Scenario 15: Buyer Engagement Scoring — Are Approved Buyers Actually Active?

**Who:** Account management  
**Goal:** Identify approved buyers who signed up but never engaged

**Steps:**

1. Set timeline to "Last 90 days" (switch to "12mo")
2. Click Users tab — note approved count
3. Click Connections tab — note total connection requests
4. Calculate: avg requests per approved buyer
5. If ratio < 0.5: many buyers approved but never requesting connections (activation problem)
6. Action: trigger re-engagement campaign for dormant approved buyers

**Gap found:** No per-buyer activity tracking. No "activation rate" metric (% approved users who sent >= 1 request within 14 days). Would need profiles JOIN connection_requests.

---

## Scenario 16: Revenue Forecasting — What's the Pipeline Worth?

**Who:** Finance team  
**Goal:** Estimate marketplace-facilitated deal value

**Steps:**

1. Set timeline to "Year to date"
2. Click Deals tab — note total revenue added and total EBITDA added
3. Apply estimated fee rate (e.g., 2% of deal value)
4. Estimate: if 20% of deals close, pipeline fee opportunity = EBITDA x multiple x 2% x 20%
5. Click Connections tab — approved connections as a proxy for pipeline advancement

**Gap found:** No deal value / TEV metric. No close rate. No fee revenue tracking. These would need Stripe/billing integration or manual deal outcome tracking.

---

## Scenario 17: Emergency Response — Why Did Signups Drop to Zero?

**Who:** Ops/engineering on-call  
**Goal:** Diagnose sudden drop in marketplace activity

**Steps:**

1. Set timeline to "Today"
2. Hero KPIs all show 0 — is the signup flow broken?
3. Switch to "Last 7 days" — was yesterday normal?
4. If yesterday had 10+ signups and today has 0: investigate signup flow
5. Check Connections tab — if also 0, the platform might be down
6. Check Meetings tab — if 0 meetings and it's a weekday, something is wrong

**Possible:** Yes, the "Today" preset enables this real-time health check.

---

## Scenario 18: Investor Due Diligence — Show Us Your Marketplace Metrics

**Who:** CEO in investor meeting  
**Goal:** Present marketplace traction data on the spot

**Steps:**

1. Open dashboard on laptop/phone
2. Set to "Year to date" for the full picture
3. Walk through hero KPIs: "We've had X signups, added Y deals representing $Z EBITDA, facilitated N connections with M meetings"
4. Click each tab to show depth
5. Switch to "Quarter to date" to show recent momentum

**Gap found:** No shareable/exportable view. No dark-mode presentation mode. No "metrics snapshot" URL that captures current filters.

---

## Scenario 19: Content Strategy — Which Industries Should We Write About?

**Who:** Content/marketing team  
**Goal:** Identify industries with highest marketplace demand for content creation

**Steps:**

1. Set timeline to "Last 90 days" (closest: "12mo")
2. Click Deals tab — check deals by industry breakdown (top 10)
3. Identify top 3 industries by deal count
4. Cross-reference with connection requests — which industries have highest requests/deal?
5. Decision: create blog posts, case studies, and email campaigns for high-demand industries

**Gap found:** No industry-level requests/deal metric. The dashboard shows industry distribution for deals but doesn't cross-tab with connection data.

---

## Scenario 20: End-of-Year Retrospective — Full Platform Review

**Who:** Entire leadership team in annual planning  
**Goal:** Comprehensive review of marketplace performance for the year

**Steps:**

1. Set timeline to "Year to date"
2. Screenshot all 5 hero KPIs
3. Walk through each sub-tab:
   - Users: total signups, approval/rejection funnel
   - Deals: inventory growth, EBITDA/revenue volume, industry diversification
   - Connections: marketplace liquidity (requests/deal), decision speed
   - Meetings: relationship-building volume
4. Set timeline to each quarter individually and compare
5. Identify: best quarter, worst quarter, trends
6. Set goals for next year based on growth rates
7. Document in annual report

**Gap found:** No period comparison mode. No trend charts. No goal-tracking (set target, show progress). Manual quarter-by-quarter switching is tedious.

---

## Summary of Gaps Found

| Gap                                                       | Scenarios Affected | Priority | Effort         |
| --------------------------------------------------------- | ------------------ | -------- | -------------- |
| **Period-over-period comparison** (delta % arrows)        | 1, 2, 7, 11, 20    | HIGH     | 4-6h           |
| **Time-series trend charts** (line/bar over months)       | 7, 11, 20          | HIGH     | 6-8h           |
| **CSV export**                                            | 2, 18              | HIGH     | 2-3h           |
| **Custom date range picker**                              | 2, 12              | MEDIUM   | 2-3h           |
| **Zero-request deals list** (stale deals)                 | 3, 14              | MEDIUM   | 3-4h           |
| **Per-admin approval breakdown**                          | 13                 | MEDIUM   | 3-4h           |
| **Buyer/seller role split on signups**                    | 8                  | MEDIUM   | 2h             |
| **Activation rate** (approved users who engaged)          | 15                 | MEDIUM   | 3h             |
| **Deal source attribution**                               | 5                  | MEDIUM   | 2h             |
| **Funnel visualization** (connection -> meeting -> close) | 6                  | LOW      | 6-8h           |
| **Time-to-approve metric** (needs schema change)          | 4                  | LOW      | 4h + migration |
| **Per-deal connection request breakdown**                 | 9, 14              | LOW      | 4h             |
| **Industry x connections cross-tab**                      | 19                 | LOW      | 3h             |
| **Goal tracking** (targets vs actuals)                    | 20                 | LOW      | 8h             |

## What Works Well

- Hero KPI strip gives instant executive summary
- 7 timeline presets cover common analysis windows
- Sub-tabs organize metrics logically without overwhelming
- Parallel queries keep load times fast
- Pending connections is live snapshot (correct semantic)
- Industry + status breakdowns provide drill-down context
