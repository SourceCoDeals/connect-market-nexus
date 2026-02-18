
# Populate valuation_leads with Historical Data from Both Files

## Data Inventory

### File 1: Calculator_1.xlsx (General Calculator)
- 184 rows, April 2025 - February 2026
- All rows have a unique `Submission ID` (e.g. `sub_8ip3xmsxof6`) that maps to `source_submission_id`
- Status breakdown: most are `Completed`, some are `Duplicate`, some are `Test`
- Key columns: Timestamp, Email, First Name, Business Name, Revenue Model, Industry, Region, Revenue, EBITDA, Exit Readiness Score, Valuation Low, Valuation High, Confidence Level (Low/Medium/High), CTA Clicked, Open to Buyer Intros, Exit Timing, Website, Location, Phone, LinkedIn URL, Submission ID, Status

### File 2: auto_valuation_leads-export (Auto Shop Calculator)
- ~10 rows total, all Adam Haile test entries from December 2025
- Each has a UUID as the primary key
- Contains rich JSON in `calculator_inputs` and `valuation_result` columns
- Key data extracted from JSON: revenue_ltm, ebitda_ltm, service_type, businessValue.low/mid/high, tier, qualityLabel.label, buyerLane.lane

## Column Mapping

### General Calculator → valuation_leads

| Source | DB Column | Notes |
|---|---|---|
| Timestamp | created_at | ISO timestamp |
| Email | email | |
| First Name | full_name, display_name | |
| Business Name | business_name | |
| Revenue Model | revenue_model | |
| Industry | industry | |
| Region | region | |
| Revenue (12mo) | revenue | Strip commas |
| EBITDA / Profit | ebitda | Strip commas |
| Exit Timing | exit_timing | |
| Open to Buyer Intros | open_to_intros | TRUE/FALSE |
| Exit Readiness Score | readiness_score | Integer |
| Valuation Low | valuation_low | |
| Valuation High | valuation_high | |
| (low+high)/2 | valuation_mid | Calculated |
| Confidence Level | quality_tier | Low/Medium/High |
| CTA Clicked | cta_clicked | TRUE/FALSE |
| Website | website | |
| Location | location | |
| Phone Number (Identified) | phone | |
| Linkedin URL | linkedin_url | |
| Submission ID | source_submission_id | Unique key for dedup |
| Status | status | 'completed' for all |
| Status = "Test" | excluded=true, exclusion_reason='test' | |
| Status = "Duplicate" | excluded=true, exclusion_reason='duplicate' | |
| calculator_type | 'general' (hardcoded) | |
| lead_source | 'initial_unlock' (hardcoded) | |

### Auto Shop Export → valuation_leads

| Source | DB Column | Notes |
|---|---|---|
| id (UUID) | id | Use as primary key |
| full_name | full_name, display_name | |
| email | email | |
| website | website | |
| created_at | created_at | |
| lead_source | lead_source | |
| calculator_inputs.revenue_ltm | revenue | Extracted from JSON |
| calculator_inputs.ebitda_ltm | ebitda | Extracted from JSON |
| calculator_inputs.service_type | industry | Extracted from JSON |
| valuation_result.businessValue.low | valuation_low | |
| valuation_result.businessValue.mid | valuation_mid | |
| valuation_result.businessValue.high | valuation_high | |
| valuation_result.tier | quality_tier | A/B/C → Low/Medium/High |
| valuation_result.qualityLabel.label | quality_label | |
| valuation_result.buyerLane.lane | buyer_lane | |
| calculator_inputs (full) | raw_calculator_inputs | JSONB |
| valuation_result (full) | raw_valuation_results | JSONB |
| calculator_type | 'auto_shop' (hardcoded) | |
| excluded | true (all test data) | All are Adam Haile entries |
| exclusion_reason | 'test' | |

## Implementation Approach

A single database migration SQL file with two INSERT blocks:

**Block 1 — General Calculator (~184 rows)**
- `INSERT INTO valuation_leads (...) VALUES (...), (...), ...`
- Uses `ON CONFLICT (source_submission_id) DO NOTHING` as a safety net if re-run
- Status logic: rows where Status = "Duplicate" get `excluded = true, exclusion_reason = 'duplicate'`; rows where Status = "Test" get `excluded = true, exclusion_reason = 'test'`; all others get `excluded = false`
- `valuation_mid` = `(valuation_low + valuation_high) / 2`
- `status` = 'completed' for all rows
- Row 133 (blank email/name) will be skipped as it has no usable data

**Block 2 — Auto Shop (~10 rows)**
- `INSERT INTO valuation_leads (...) VALUES (...), ...`
- Uses `ON CONFLICT (id) DO NOTHING`
- All rows marked `excluded = true, exclusion_reason = 'test'` (all are Adam Haile test submissions from December 2025)
- The pipe-delimited JSON strings in the export are reconstructed to valid JSON for the JSONB columns
- Only the key extracted fields (revenue, ebitda, valuation_low/mid/high, etc.) are stored in named columns; the full JSON is stored in raw_calculator_inputs and raw_valuation_results

## Expected Row Counts
- General: ~183 insertable rows (1 blank row skipped)
  - ~130 rows: excluded=false (Completed)
  - ~40 rows: excluded=true, exclusion_reason='duplicate'
  - ~13 rows: excluded=true, exclusion_reason='test'
- Auto Shop: ~10 rows, all excluded=true (test)
- **Total: ~193 rows**

## What Will NOT Change
- No new tables or schema changes
- No code changes
- No file upload infrastructure
- Pure one-time data migration SQL only
