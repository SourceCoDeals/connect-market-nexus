

# Verify & Fix: Valuation Lead Detail Drawer — Lead Source + Data Completeness

## Current State

The detail drawer (`ValuationLeadDetailDrawer.tsx`) is fully built and wired up. Clicking a row opens it with:
- Contact info (name, email, phone, website, LinkedIn, location, submitted date)
- Valuation results (business value range, property value, quality tier, buyer lane, narrative, strengths/weaknesses, score breakdown)
- Calculator inputs (grouped by step_name, sorted by step number, showing question/label/description)
- Action footer (Push to Deals, View Deal, Mark Not Fit)

**The data parsing in `detailHelpers.ts` correctly handles the full submission payload you shared** — all 18 calculator input fields will group into 5 sections (Shop Basics, Financials, Customers & KPIs, People & Owner, Facility & Real Estate), and all valuation result fields (businessValue, propertyValue, buyerLane, qualityLabel, narrative, scoreBreakdown, factors) are extracted.

## What's Missing

1. **Lead Source** is not displayed anywhere — the `lead_source` field (e.g., "full_report", "initial_unlock", "spreadsheet_upload") is stored but never shown in the drawer or table. This is the key field that tells you *where each lead came from*.

2. **Tier badge** — `results.tier` ("A", "B", "C") is parsed but not rendered in the drawer header.

3. **Location from submission** — The incoming payload includes `city`, `region`, `country` (geo-IP data), but these are stored in `incoming_leads` only, not in `valuation_leads`. The drawer currently shows `lead.location` which may be null. This is a minor gap — the geo data is in the raw table.

## Changes

### 1. Add Lead Source badge to drawer header
In `ValuationLeadDetailDrawer.tsx`, add a badge after the calculator_type badge showing `lead.lead_source` with a human-readable label:
- `full_report` → "Full Report"
- `initial_unlock` → "Initial Unlock"  
- `spreadsheet_upload` → "Spreadsheet Upload"
- fallback: display raw value with underscores replaced

### 2. Add Tier badge to drawer header
Show `results.tier` (A/B/C) as a colored badge next to the quality label.

### 3. Add Lead Source column to table (optional but recommended)
Not strictly required since the drawer shows it, but a small "Source" column in the table would let you see at a glance where each lead came from without opening the drawer.

### Files to edit
| File | Change |
|------|--------|
| `ValuationLeadDetailDrawer.tsx` | Add lead_source badge + tier badge in header |

