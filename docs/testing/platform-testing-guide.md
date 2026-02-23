# SourceCo Platform: Comprehensive Testing Guide

## Test All Workflows, Edge Cases, and Integrations

---

## PART 1: DEAL RANKING & SCORING SYSTEM

### 1.1 Deal Scoring on First Import
- Upload deal with zero data, LinkedIn-only, 0 employees, $0 EBITDA, $50M+ EBITDA, contradictory data

### 1.2 Seller Motivation Integration (Fireflies)
- Conflicting transcript signals, multiple transcripts, jargon, short/long calls, already-sold deals

### 1.3 Manual Drag-and-Drop Ranking
- Drag and refresh, repeated moves, pins vs algorithm, missing data deals, closed deals, drift over time

### 1.4 Industry Tier Impact
- Unlisted industry, classification changes, geography sub-weighting, buyer exclusions

### 1.5 Revenue Quality Scoring
- No revenue data, mixed/hard-to-categorize, suspicious claims, sudden changes

---

## PART 2: UNIFIED BUYER MESSAGING & OUTREACH

### 2.1 Single Buyer Messaging
- Duplicate sends, DNC list, competitor warnings, closed deals, incomplete contacts, message length limits

### 2.2 Bulk Messaging
- 0 buyers, 50+ buyers, duplicates, email bounces, region mismatches, re-reaching warnings

### 2.3 Buyer Routing
- No matching industry, no matching geography, partial fits, incomplete buyer profiles, mid-campaign changes

### 2.4 Message History & Tracking
- Old messages (6+ months), duplicate contacts, replies, LinkedIn (untracked), spam reports

---

## PART 3: DEAL ENRICHMENT & DATA QUALITY

### 3.1 LinkedIn Employee Count
- Outdated URLs, unlisted counts, name changes, duplicate profiles, blocked scraping, wildly off estimates

### 3.2 Website Team Page
- No team page, discrepancies with LinkedIn, outdated pages, site down, international team

### 3.3 Google Reviews (Consumer Only)
- B2B skip, duplicate reviewers, complaints, zero reviews, deleted reviews, low ratings

### 3.4 Enrichment Status & History
- Stuck "In Progress" (24h+), repeated re-enrich clicks, significant score changes, historical data

---

## PART 4: AI MEMO GENERATION & DATA ROOM

### 4.1 Generate Memo from Transcript
- Short/long transcripts, poor audio, accents, confidential info, regeneration, data changes post-generation

### 4.2 Edit & Upload PDF
- Corrupted .docx, images/charts, large files (50MB), unrelated uploads, version history, stale data

### 4.3 Memo Tone Validation (Manual)
- Facts only, no marketing language, specific numbers, third person, no adjectives
- Hard-pitching seller, industry jargon, risks/challenges, vague financials

### 4.4 Memo Distribution & Access
- Competitor sharing, confidential details, access revocation, bulk sharing, teaser vs full, stale contacts

---

## PART 5: REMARKETING & CAMPAIGNS

### 5.1 Creating Campaigns
- Zero previous outreach, identical messages, closed deals, past end dates, DNC, contradictions

### 5.2 Performance Tracking
- High spam rates, metric sync issues, old campaigns, cross-deal attribution, high open/no click

### 5.3 Audience Exclusions
- Manual overrides, DNC + active deal exceptions, message thresholds, mid-campaign exclusion changes

---

## PART 6: BUYER DATABASE & CONTACTS

### 6.1 Importing Buyers (CSV)
- Duplicates, mismatched headers, bad data, 5000+ import, existing buyer conflicts, custom fields

### 6.2 Auto-Discovering Contacts
- Site down, no team page, 100+ contacts, no role listed, cross-platform dedup, zero results

### 6.3 Manually Adding Contacts
- Bad email format, LinkedIn mismatch, duplicates, incomplete info, personal emails

### 6.4 Contact History
- Job changes, 5+ unanswered messages, voicemails, stale conversations, duplicate sender tracking

---

## PART 7: FIREFLIES INTEGRATION

### 7.1 Uploading Transcripts
- Zero-sentence calls, group calls, non-English, messy transcripts, [inaudible] flags, duplicates

### 7.2 Seller Motivation Extraction
- Cautious/vague sellers, contradictions, pitching vs selling, no signals, competing offers

### 7.3 Business Model Extraction
- Vague revenue descriptions, missing percentages, customer concentration gaps, contradictions

---

## PART 8: UNIVERSES & TRACKER MANAGEMENT

### 8.1 Creating Universes
- Empty universes, overlapping buyers, special characters, 50+ universes, renaming

### 8.2 Tracking Deals Pitched
- Accidental duplicates, pass reasons, mid-campaign universe updates, cross-universe tracking

### 8.3 Universe Analytics
- Zero deals pitched, mixed results segmentation, historical data accuracy

---

## PART 9: PERMISSIONS & TEAM WORKFLOWS

### 9.1 Role-Based Messaging
- Junior analyst blocked, manager approval/revocation, duplicate team messages, departed employees

### 9.2 Deal Assignment
- Reassignment mid-campaign, dual assignment, unassignment

---

## PART 10: ERROR HANDLING

### 10.1 Network & System Errors
- Poor connection queuing, enrichment failures, memo timeouts, browser close mid-send, partial imports

### 10.2 Data Validation
- Empty selections, corrupt uploads, double-click submissions, character limits, special filenames

---

## BUG REPORT FORMAT

```
ISSUE: [Short description]
Steps:
1. [Step 1]
2. [Step 2]
Expected: [What should happen]
Actual: [What happened]
Context: [Desktop/Mobile, Browser, Reproducible?]
```
