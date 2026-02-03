
Goal
- Fix the CSV upload “CSV columns list” being incomplete/“limited” on /admin/remarketing/deals, and make the import path robust so future edits actually take effect and can be verified quickly.

What’s actually happening (root cause)
- The UI builds the visible “CSV columns list” from `columnMappings`.
- `columnMappings` is currently set to `mappingResult.mappings` when the edge function returns anything at all.
- The edge function (Gemini tool-call) is not guaranteed to return a mapping object for every input column. It often returns a partial list (only columns it’s confident about).
- Result: the UI silently drops the columns the model didn’t return, so you only see a subset of CSV columns (even though PapaParse successfully detected them).
- This matches your screenshot symptom exactly: you see “X/Y mapped” but your expected columns never appear in the list at all.

CTO-level audit findings (key weak points)
1) Contract mismatch between frontend and map function
   - Frontend assumes `mappings` is a complete, ordered list. Backend/AI returns a partial, unordered list.
   - No validation, no reconciliation, no telemetry when mismatch occurs.
2) Missing “truth source” for columns in UI
   - UI should always render all parsed columns (the ground truth) and overlay mapping suggestions—not replace the list with AI output.
3) No explicit invariants enforced
   - We should enforce: `columnMappings.length === columns.length` always.
   - We should enforce: every `csvColumn` in `columns` appears exactly once in mappings.
4) Debuggability
   - We need one glance confirmation: “Parsed 28 columns” and optionally “AI returned 19 mappings → filled 9 blanks”.
   - Currently you’re forced into screenshots and guessing.

Fix design (high-confidence, minimal-risk)
A) Frontend: always render the full parsed column list; merge AI results into it
- In `DealImportDialog.tsx` (the route you’re on: /admin/remarketing/deals):
  1. Keep `columns` as the source of truth (from `results.meta.fields`, already done).
  2. When `mappingResult.mappings` returns, do NOT assign it directly.
  3. Instead, build a merged list in the exact order of `columns`:
     - Create a lookup map from `mappingResult.mappings` by `csvColumn` (normalized).
     - For each `col` in `columns`, output:
       - If AI gave a mapping for that column: use it.
       - Else: `{ csvColumn: col, targetField: null, confidence: 0, aiSuggested: false }`.
  4. Add small, explicit UI telemetry:
     - Badge: “Parsed: 28 columns”
     - Badge: “AI returned: N mappings”
     - Badge: “Filled: columns.length - N blanks”
     - Keep the existing `_version` badge.

- Repeat the same merge logic in `DealCSVImport.tsx` for consistency (even if it’s not the active route today). This prevents reintroducing drift.

B) Backend: enforce complete mappings server-side (defense in depth)
- In `supabase/functions/map-csv-columns/index.ts`:
  1. After parsing AI output into `mappings`, normalize them:
     - Deduplicate by `csvColumn`
     - Ensure all requested `columns` are present (same merge strategy as frontend)
  2. Return `mappings` always as a complete list matching input `columns` length and order.
  3. Add structured logs:
     - requested_columns_count
     - ai_returned_count
     - final_returned_count
     - any_missing_columns (first 10 for log safety)

This makes the system correct even if a future UI accidentally reverts to using backend mappings blindly.

C) Make the bug impossible to miss in the future (guardrails)
- Add a runtime assertion (non-crashing) in the UI:
  - If `columnMappings.length !== columns.length`, toast a warning: “Mapping response incomplete; filling missing columns.”
  - Also log the mismatch with counts and a sample of missing columns.

D) End-to-end verification using your exact uploaded CSV
- Add a deterministic local verification step in the UI console logs when parsing:
  - Log the full parsed `columns` list once (or first 50) with count.
- Test on /admin/remarketing/deals:
  1. Upload `Test_deals-3.csv`
  2. Confirm:
     - “Parsed: 28 columns” badge
     - Table shows all headers including Website URL, Phone Number, LinkedIn URL, Revenue, EBITDA, Address, Google Review fields, Fireflies Recording, etc.
     - Even if AI maps only some, the rest appear with “Don’t import”.
  3. Confirm that column sample values render correctly for later columns (ensures row key access is consistent with header normalization).

Expected outcome
- The CSV columns list will always show every column in the file.
- AI mapping will only affect the “Map To” dropdown pre-selections, not which columns are visible.
- This eliminates the “none of your changes took effect” feeling because you’ll have explicit telemetry: parsed columns count, AI returned count, filled blanks count, function version.

Implementation steps (sequenced)
1) Read/confirm current parsing + mapping code paths for /admin/remarketing/deals (DealImportDialog).
2) Implement `mergeColumnMappings(columns, aiMappings)` in a shared place (either:
   - inline in both components for speed, or
   - a small helper in `src/lib/deal-csv-import/` to prevent duplication).
3) Update `DealImportDialog.tsx` to use merge result, add badges/telemetry.
4) Update `DealCSVImport.tsx` to use the same merge helper.
5) Update edge function `map-csv-columns` to always return complete mapping array (same order as input columns).
6) Verify end-to-end with your `Test_deals-3.csv`:
   - Confirm the missing columns now appear.
   - Confirm “AI returned N” doesn’t impact visibility.
7) Optional but recommended: add a “Download mapping JSON” button for quick debugging when anything looks off.

Risk/edge cases considered
- Column name normalization: We’ll normalize both sides (parsed columns + AI-returned csvColumn) with the same `normalizeHeader` to avoid “Website URL” vs “Website URL “ mismatches.
- Duplicate headers: If a CSV has duplicate column names, PapaParse can behave oddly. We’ll detect duplicates and show a warning badge (future-proofing).
- Large CSV: No additional heavy processing; merging is O(n). Safe.

Non-goals (for this fix)
- Improving AI accuracy of the mapping itself (we can do that next, but first we must make sure the UI shows the real columns consistently).
- Changing DB schema or import field set.

Technical notes (for reviewers)
- Core invariant to enforce: `finalMappings.length === columns.length` and `finalMappings[i].csvColumn === columns[i]`.
- Backend and frontend both enforce the invariant to prevent drift and to keep debugging simple.
