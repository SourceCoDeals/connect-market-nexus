## CHANGELOG

### 2026-02-28 — CTO Deep-Dive Audit

- **What:** Comprehensive CTO-level audit covering architecture, security, database, code quality, CI/CD, testing, and documentation. Generated `CTO_DEEP_DIVE_AUDIT_2026-02-28.md` with full findings.
- **Why:** Periodic deep audit to assess platform health, identify risks, and ensure documentation is best-in-class
- **Key findings:** Platform graded B+ overall. 0 critical issues, 5 high, 8 medium, 6 low. 22 npm audit vulnerabilities identified (xlsx has no fix). CORS shared module adoption at ~20% of edge functions.
- **Files changed:** CTO_DEEP_DIVE_AUDIT_2026-02-28.md (new), CHANGELOG.md, docs/EDGE_FUNCTIONS.md, docs/DATABASE.md
- **DB changes:** None
- **Link:** Branch `claude/coding-task-Tr8LE`

---

### 2026-02-27 — PR #310: Standup Meeting Detection Fix

- **What:** Fixed `<ds>` standup meeting detection with Fireflies API fallback and polling sync safety net
- **Why:** Webhook handler was silently skipping standup meetings when Fireflies payload lacked meeting titles
- **Files changed:** `fireflies-webhook-handler`, new `sync-standup-meetings` edge function, cron migration
- **DB changes:** New cron job for 30-minute Fireflies polling sync
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/310

---

### 2026-02-27 — Fix 7 Data-Loss and Observability Bugs

- **What:** Critical quality fixes across enrichment pipelines — fixed `ignoreDuplicates` in buyer contact enrichment, replaced 8 silent `.catch(() => {})` handlers with logged versions, fixed process-enrichment-queue pending vs processing counts, consolidated duplicate `normalizeState()` to shared `geography.ts`, adjusted EBITDA detection threshold from <100 to <20
- **Why:** Deep audit revealed data-loss risks and silent failure patterns in enrichment pipeline
- **Files changed:** 13 files (+61/-73 lines)
- **DB changes:** None

---

### 2026-02-27 — Fix 4 Extraction/Scoring Pipeline Bugs

- **What:** Fixed extraction and scoring pipeline bugs found in deep audit including footprint scraping wired to geography extraction, score across all linked universes
- **Why:** Deep audit revealed edge cases in deal extraction and cross-universe scoring
- **Files changed:** ReMarketingDealMatching components, scoring functions, geography extraction

---

### 2026-02-27 — PR #308: Decision Maker Finder

- **What:** Added standalone Python script for decision maker discovery, replaced Apify LinkedIn scraping with Serper-based approach, improved LinkedIn discovery with domain-based search and noise filtering, added LinkedIn URL verification to contact enrichment
- **Why:** Apify LinkedIn scraping was unreliable; Serper provides more consistent results with lower cost
- **Files changed:** `scripts/decision_makers_finder.py`, contact enrichment functions
- **DB changes:** None

---

### 2026-02-27 — PR #307: My Deals Tab & Salesforce Integration

- **What:** Added My Deals tab to Active Deals page, included Salesforce in deal source filter, removed Salesforce tab from Active Deals, added Salesforce webhook support
- **Why:** Consolidate deal views and integrate Salesforce pipeline
- **Files changed:** Active Deals page, Salesforce webhook handler, deal source components
- **DB changes:** None

---

### 2026-02-26 — CTO Audit & Remediation Session
- **What:** Comprehensive platform audit covering database, AI Command Center, enrichment pipeline, integrations, navigation, code documentation, code organisation, and security
- **Why:** CTO-level audit to identify and fix broken references, missing documentation, security gaps, and code organisation issues
- **Files changed:** Multiple — see AUDIT_REPORT_2026-02-26.md for full list
- **DB changes:** Audit of unified contacts migration, table reference fixes
- **Link:** See PR on branch claude/sourceco-code-audit-yduOu

---

### 2026-02-25 — PR #283: Fix Marketplace Button & Queue Navigation
- **What:** Increased flag size, reordered UI, added Marketplace Queue link to sidebar navigation
- **Why:** Improve marketplace button visibility and add queue access to navigation
- **Files changed:** UI components, sidebar navigation
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/283

---

### 2026-02-24 — PR #281: Adjust Design Colors
- **What:** Toned down intense yellow/gold colours across the design system
- **Why:** Visual improvement — original colours were too intense
- **Files changed:** Design system, colour variables
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/281

---

### 2026-02-23 — PR #280: Marketplace Queue Feature
- **What:** Added marketplace queue feature, fixed Push to Marketplace button in monolithic deal detail file
- **Why:** Enable marketplace queue workflow for deal management
- **Files changed:** Marketplace components, deal detail
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/280

---

### 2026-02-23 — PR #279: Flag Connection Requests
- **What:** Added flagging capability for connection requests
- **Why:** Allow admins to flag and manage connection requests
- **Files changed:** Connection request components
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/279

---

### 2026-02-22 — PhoneBurner Manual Token Integration
- **What:** Removed PhoneBurner OAuth flow, switched to manual access tokens, enhanced dialer identifiers
- **Why:** OAuth flow was unreliable; manual tokens provide more stable integration
- **Files changed:** PhoneBurner integration files, OAuth callback, push contacts
- **DB changes:** Schema changes for manual token support
- **Link:** Multiple commits on main branch

---
