## CHANGELOG

### 2026-02-26 — Audit Session: CTO Remediation Phase 0–10
- **What:** Full CTO-level audit and remediation of the SourceCo platform
- **Why:** Systematic review of database, AI Command Center, integrations, security, documentation, and code organisation
- **Files changed:** See AUDIT_REPORT_2026-02-26.md for complete list
- **DB changes:** Audit-only — no schema modifications in this session
- **Link:** See PR for this branch

---

### 2026-02-26 — PR #280: Marketplace Queue Feature (Merge)
- **What:** Merged marketplace queue feature for pushing deals from deal page
- **Why:** Enable pushing deals to marketplace directly from deal detail view
- **Files changed:** Deal detail components, marketplace queue logic
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/280

---

### 2026-02-26 — PR #279: Flag Connection Requests (Merge)
- **What:** Merged flag-for-review feature on connection requests with team member assignment
- **Why:** Allow team members to flag connection requests for review and assign to specific team members
- **Files changed:** Connection request components, daily task auto-creation
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/279

---

### 2026-02-25 — PR #278: Marketplace Queue Feature
- **What:** Push to Marketplace button added to deal detail page
- **Why:** Streamline workflow for pushing remarketing deals to the marketplace
- **Files changed:** Deal detail components, WebsiteActionsCard
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/278

---

### 2026-02-25 — PR #277: Marketplace Queue Feature (Continued)
- **What:** Continued marketplace queue feature development
- **Why:** Feature required multiple iterations to handle monolithic deal detail file
- **Files changed:** ReMarketingDealDetail.tsx and related components
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/277

---

### 2026-02-25 — PR #276: Fix Tasks Visibility
- **What:** Fixed My Tasks showing empty when tasks exist under user's name
- **Why:** Tasks were assigned but not appearing due to assignee_id mismatch
- **Files changed:** Task query logic, migration for reconciling assignee_ids
- **DB changes:** Migration to reconcile misassigned task assignee_ids
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/276

---

### 2026-02-25 — PR #275: Search Duplicate Contacts
- **What:** Deduplicate contacts and prevent future duplicates for null-email contacts
- **Why:** Duplicate contacts were being created when email was null
- **Files changed:** Contact deduplication logic
- **DB changes:** Deduplication migration
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/275

---

### 2026-02-25 — PR #274: Number Comma Formatting
- **What:** Added comma formatting to financial overview number inputs
- **Why:** Large financial numbers were hard to read without formatting
- **Files changed:** Financial overview components
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/274

---

### 2026-02-24 — PR #272: Flag Connection Requests
- **What:** Added flag-for-review on connection requests with team member assignment
- **Why:** Need ability to flag and route connection requests for team review
- **Files changed:** Connection request components, tables
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/272

---

### 2026-02-24 — PR #270: Fix Connection Search Bar
- **What:** Fixed connection requests search bar filtering out lead-only requests
- **Why:** Search was not returning results for lead-only requests
- **Files changed:** Connection requests table filtering
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/270

---
