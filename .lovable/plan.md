

# Valuation Lead Detail View — Full Submission Profile

## Problem

There is **no dedicated detail view** for valuation leads. Clicking a row immediately creates a listing and navigates to the deal page. The rich calculator submission data (with human-readable labels, descriptions, questions, step names) is stored as raw JSONB in `raw_calculator_inputs` and `raw_valuation_results`, but **never rendered anywhere in the UI**.

The incoming payload includes structured metadata per field:
```json
{
  "revenue_ltm": {
    "value": 44444444,
    "label": "$44,444,444",
    "question": "Annual Revenue (Last 12 Months)",
    "hint": "Total sales from all services",
    "step": 2,
    "step_name": "Financials"
  }
}
```

This means we can render beautiful, grouped, plain-text output directly from the stored JSONB — no lookup tables needed.

## Data Issues to Fix First

The latest submission (`ahaile14@gmail.com`) still shows `calculator_type: auto_shop` and `buyer_lane: independent_sponsor` — the previous fixes weren't applied before this submission arrived. We need to **re-process** this lead or update it manually.

## Plan

### 1. Create `ValuationLeadDetailDrawer` component

A slide-out drawer (Sheet) that opens when clicking a valuation lead row (instead of immediately creating a listing). It will display:

**Header**: Business name, contact info, website, lead source, submitted date

**Calculator Inputs section** — parsed from `raw_calculator_inputs`:
- Group inputs by `step_name` (e.g., "Shop Basics", "Financials", "Customers & KPIs", "People & Owner", "Facility & Real Estate")
- Sort by `step` number within each group
- For each input, show:
  - **Question** as the label (e.g., "Annual Revenue (Last 12 Months)")
  - **Label** as the value (e.g., "$44,444,444" or "Growing")
  - **Description** as secondary text when present

**Valuation Results section** — parsed from `raw_valuation_results`:
- Business Value range (low/mid/high) formatted as currency
- Quality Label + Tier badge
- Buyer Lane title + description
- EBITDA Multiple and Revenue Multiple
- Narrative text
- Positive/Negative factors as bullet lists
- Score Breakdown as a mini table (financials, customerMix, kpis, etc.)
- Property Value (if present) with cap rate

**Actions footer**: Push to Active Deals, Mark Priority, Mark Not a Fit

### 2. Update row click behavior

In `useValuationLeadsMutations.ts`, change `handleRowClick` to open the drawer with the selected lead instead of immediately creating a listing. The drawer will have a "View Deal" button for already-pushed leads and a "Push to Deals" button for unpushed ones.

### 3. Helper: `parseCalculatorInputs(raw: Record<string, unknown>)`

A utility function in `helpers.ts` that:
- Iterates over the JSONB keys
- Groups entries by `step_name`
- Sorts by `step` number
- Returns structured data: `{ groupName: string, fields: { question: string, label: string, description?: string }[] }[]`

### 4. Helper: `parseValuationResults(raw: Record<string, unknown>)`

Extracts and formats:
- `businessValue` → formatted currency range
- `qualityLabel` → label + description
- `buyerLane` → title + description
- `scoreBreakdown` → key-value pairs with readable names
- `positiveFactors` / `negativeFactors` → string arrays
- `narrative` → paragraph text
- `propertyValue` → formatted with cap rate info

### Files to create/edit

| File | Action |
|------|--------|
| `src/pages/admin/remarketing/ValuationLeads/ValuationLeadDetailDrawer.tsx` | **Create** — full detail drawer component |
| `src/pages/admin/remarketing/ValuationLeads/helpers.ts` | **Edit** — add `parseCalculatorInputs` and `parseValuationResults` helpers |
| `src/pages/admin/remarketing/ValuationLeads/index.tsx` | **Edit** — add drawer state, pass to table |
| `src/pages/admin/remarketing/ValuationLeads/useValuationLeadsMutations.ts` | **Edit** — change `handleRowClick` to set selected lead for drawer instead of creating listing |
| `src/pages/admin/remarketing/ValuationLeads/ValuationLeadsTable.tsx` | **Edit** — minor: pass through drawer open handler |

