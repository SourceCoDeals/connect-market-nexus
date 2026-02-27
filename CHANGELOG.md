## CHANGELOG

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
