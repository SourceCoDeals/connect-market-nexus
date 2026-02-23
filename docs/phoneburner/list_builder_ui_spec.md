# SourceCo → Phoneburner: List Builder & Export Feature
## UI/UX Specification for One-Click List Deployment

---

## Executive Summary

**Goal:** Enable reps to build, filter, and push calling lists to Phoneburner in under 60 seconds, eliminating manual CSV exports and ensuring all contextual data flows to the dialer for efficient conversations.

**Current Pain:** Reps spend 10-15 minutes per day exporting filtered lists to CSV, manually uploading to Phoneburner, and losing critical context (deal history, engagement data, talking points) in the transfer.

**Target Experience:** 
1. Filter contacts in SourceCo (3 clicks)
2. Review list preview with validation warnings (10 seconds)
3. Click "Push to Phoneburner" → Select/create dial session (2 clicks)
4. Contacts appear in Phoneburner dialer within 30 seconds, enriched with context

---

## Feature Locations & Entry Points

### Primary Entry Points

**1. Buyers Table** (`/buyers`)
- **Location:** Action toolbar above table (next to existing bulk actions)
- **Button:** "Push to Dialer" icon (phone + arrow)
- **Behavior:** Pushes all contacts matching current filters OR selected contacts if checkboxes used

**2. Sellers/Prospects Table** (`/sellers`, `/prospects`)
- **Location:** Same as buyers table
- **Identical behavior** to buyers workflow

**3. Deal Detail Page → Contacts Tab** (`/deals/{id}/contacts`)
- **Location:** Above contact list table
- **Button:** "Push All to Dialer" 
- **Use Case:** Push all contacts associated with specific deal (for deal-specific outreach campaigns)

**4. Contact Lists/Segments** (`/lists`, `/segments/{id}`)
- **Location:** List detail header
- **Button:** "Push List to Dialer"
- **Use Case:** Saved/dynamic segments (e.g., "Inactive PE Buyers - 90+ Days", "Hot Seller Leads")

**5. Search Results** (`/search`)
- **Location:** Results header (after search executed)
- **Button:** "Push Results to Dialer"
- **Use Case:** Ad-hoc searches (e.g., "PE firms in Texas with >$500M AUM")

---

## User Interface Design

### Step 1: List Building & Filtering

**Current State (Keep This):**
- Reps already use SourceCo's existing filter system
- Filters include: Contact type, buyer type, industry, geography, engagement score, last contact date, deal status, etc.

**Enhancement Needed:**
- Add **"Dialable Contacts Only"** quick filter toggle
  - Auto-excludes: do_not_call, phone_number_invalid, suppressed contacts
  - Shows count: "243 dialable / 312 total contacts"

**Visual Indicator:**
- Add phone icon to contact rows that are "ready to dial" (valid phone, not suppressed)
- Gray out rows that are blocked (with hover tooltip explaining why)

---

### Step 2: Push to Dialer Button Click → Modal Opens

```
┌─────────────────────────────────────────────────────────────────┐
│  Push to Phoneburner                                        [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 List Summary                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ✓ 88 contacts ready to push                              │ │
│  │  ⚠ 12 contacts excluded (see details below)              │ │
│  │  🕒 Estimated dial time: ~3.5 hours                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  🎯 Select Dial Session                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ○ Create New Session                                     │ │
│  │     Session Name: [PE Buyers - Feb 2026 Outreach____]     │ │
│  │                                                            │ │
│  │  ● Add to Existing Session                                │ │
│  │     [🔍 PE Buyers - Feb 2026 Outreach        ▼]           │ │
│  │     Currently: 45 contacts • Last activity: 2 hours ago   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⚙️ Push Options                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ☑ Skip contacts called in last 7 days                   │ │
│  │  ☑ Update existing contacts if already in session        │ │
│  │  ☐ Auto-start dialing after push (requires PB desktop)   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⚠️ Excluded Contacts (12)                     [Show Details] │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │                    Cancel          [Push to Dialer]   │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

**Modal Sections Explained:**

#### 📊 List Summary (Auto-calculated)
Shows at-a-glance metrics:
- **Ready to push:** Contacts passing all validation checks
- **Excluded:** Contacts blocked (with expandable details)
- **Estimated dial time:** Based on average 2.5 min/contact including ring, talk, disposition time

#### 🎯 Select Dial Session
**Option A: Create New Session**
- Auto-generates name based on context (e.g., "PE Buyers - Feb 2026 Outreach")
- Editable by rep
- Creates new session in Phoneburner via API

**Option B: Add to Existing Session** (Recommended default)
- Dropdown shows rep's recent/active sessions
- Shows session metadata (contact count, last activity time)
- Prevents duplicate work (rep can add to in-progress campaign)

**Smart Default:**
- If rep pushed similar list recently (same filters), pre-select that session
- Otherwise, default to "Create New Session"

#### ⚙️ Push Options
**Skip contacts called in last 7 days:**
- Prevents contact fatigue
- Configurable threshold (7 days default, can be 3/7/14/30 days)
- Override available for urgent campaigns

**Update existing contacts:**
- If contact already in session, update their info (phone, email, custom fields)
- vs. Skip duplicates entirely

**Auto-start dialing:**
- If Phoneburner desktop app detected, can trigger dial session automatically
- Saves rep one extra step

---

### Step 3: Excluded Contacts Details (Expandable)

When rep clicks "Show Details" on excluded contacts:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Excluded Contacts (12)                         [Hide Details]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🚫 Suppressed - Do Not Call (3)                                │
│  • John Smith (Heritage Capital) - Requested removal 2025-11-15│
│  • Sarah Johnson (Summit Partners) - Legal DNC list            │
│  • Mike Chen (Vista Equity) - Internal policy                  │
│                                                                 │
│  📞 Invalid Phone Number (2)                                    │
│  • Emily Davis (Thoma Bravo) - Wrong number (last call)        │
│  • Robert Lee (Blackstone) - Disconnected                      │
│                                                                 │
│  🕒 Recently Contacted (7)                                      │
│  • Alex Martinez (KKR) - Called 2 days ago                     │
│  • Jessica Wong (Carlyle) - Called 3 days ago                  │
│  • David Kim (TPG) - Called 4 days ago                         │
│  • Lisa Chen (Advent) - Called 5 days ago                      │
│  • Tom Wilson (Bain Capital) - Called 6 days ago               │
│  ... [+2 more]                                                  │
│                                                                 │
│  [Override & Include All]  [Keep Exclusions]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Override Option:**
- Allows rep to force-include excluded contacts (except legal DNC)
- Shows confirmation: "Are you sure? This contact was called 2 days ago."
- Logs override in audit trail (who, when, reason)

---

### Step 4: Processing & Confirmation

**While Pushing (Progress Indicator):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Pushing to Phoneburner...                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ████████████████████░░░░░░░░  75% (66 of 88 contacts)         │
│                                                                 │
│  ✓ Mapping contact data...                                     │
│  ✓ Uploading to session "PE Buyers - Feb 2026"...              │
│  → Creating contacts in Phoneburner...                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Success Confirmation:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Successfully Pushed to Phoneburner!                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Summary                                                     │
│  • 88 contacts added to "PE Buyers - Feb 2026 Outreach"        │
│  • 12 contacts excluded (7 recently contacted, 3 DNC, 2 invalid)│
│  • Session ready for dialing                                    │
│                                                                 │
│  🔗 Quick Actions                                               │
│  [Open in Phoneburner]  [View Session Details]  [Done]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**"Open in Phoneburner" Button:**
- Deep link: `phoneburner://session/{session_id}` (desktop app)
- Fallback: `https://app.phoneburner.com/sessions/{session_id}` (web)
- Rep can immediately start dialing

---

## Data Mapping: What Gets Pushed

### Standard Fields (Always Included)

```
SourceCo Field          → Phoneburner Field
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
first_name              → first_name
last_name               → last_name
company                 → company
phone                   → phone (formatted to E.164)
email                   → email
title                   → title
address_line1           → address
city                    → city
state                   → state
zip                     → zip
```

### Custom Fields (Critical Context for Reps)

**Pushed to `custom_fields` in Phoneburner:**

```javascript
custom_fields: {
  // LINKING (Required for webhook sync)
  sourceco_contact_id: "sc_buyer_789",
  
  // CLASSIFICATION
  contact_type: "buyer",              // or "seller"
  buyer_type: "PE Firm - LMM",        // or "Strategic", "Family Office", etc.
  
  // FIRMOGRAPHICS (for context during call)
  aum: "$500M",
  fund_size: "$250M Fund III",
  target_ebitda_range: "$2M - $10M",
  target_sectors: "Business Services, Healthcare IT, Software",
  target_geographies: "Northeast, Mid-Atlantic",
  
  // RELATIONSHIP CONTEXT
  last_contact_date: "2026-01-15",
  last_contact_method: "email",
  last_contact_outcome: "Opened, no response",
  engagement_score: "75",
  relationship_strength: "warm",
  
  // DEAL CONTEXT (Talking Points!)
  active_deals_count: "3",
  last_deal_presented: "Collision Repair Platform - Dec 2025",
  last_deal_outcome: "Passed - Too early stage",
  
  // CALL PREP
  call_talking_points: "New collision repair platform deal, $8M EBITDA, NC-based. Buyer has existing auto aftermarket portfolio company looking for add-ons.",
  preferred_contact_time: "Morning 9-11 AM EST",
  assistant_name: "Mary Johnson",
  assistant_phone: "+1-555-0124",
  
  // ATTRIBUTION
  contact_owner: "Sarah Johnson",
  contact_source: "SourceCo Remarketing - Feb 2026 Campaign"
}
```

**Why This Matters:**
Reps see this context in Phoneburner during calls → No more "blind dialing"

---

## Advanced List Building Features

### Feature 1: Smart List Suggestions

**Location:** Above filter controls in Buyers/Sellers tables

```
💡 Suggested Lists

[📋 Inactive Buyers (90+ Days)]  [🔥 High Engagement]  [📅 Callback Due Today]
```

**Pre-built filters:**
- **Inactive Buyers (90+ Days):** Last contact >90 days, engagement score >50, not DNC
- **High Engagement:** Engagement score >75, last contact <30 days
- **Callback Due Today:** Next action type = call, next action date = today
- **New This Month:** Created date within last 30 days
- **Passed on Deals:** Last disposition = "Not a Fit" but >180 days ago (re-engage)

**Benefit:** One-click list creation for common scenarios

---

### Feature 2: List Templates

**Location:** New tab in Contact Lists section (`/lists/templates`)

**Allows creating reusable list templates:**

Example Template: "Monthly PE Buyer Outreach"
```
Filters:
- Contact Type: Buyer
- Buyer Type: PE Firm
- Last Contact Date: >30 days
- Engagement Score: >60
- Do Not Call: False
- Phone Valid: True

Auto-Schedule:
- Push to Phoneburner: First Monday of month, 8:00 AM
- Session Name: "PE Buyers - {Month} {Year}"
- Assigned To: Sarah Johnson
```

**Use Case:** Automate recurring campaigns (monthly reactivation, quarterly check-ins)

---

### Feature 3: Quick Filters Bar

**Location:** Sticky toolbar above tables

```
Filters:  [All Contacts ▼]  [Last Contact ▼]  [Engagement ▼]  [Geography ▼]  [+ Add Filter]

Quick:    [✓ Dialable Only]  [Called This Week]  [Never Contacted]
```

**Dialable Only Toggle:**
- Single click to show only contacts ready to dial
- Hides suppressed, invalid phone, DNC contacts
- Shows count: "243 dialable of 312 total"

---

### Feature 4: Bulk Actions Bar

**Location:** Appears when contacts selected via checkboxes

```
[✓] 15 contacts selected

[Push to Dialer]  [Add to List]  [Update Status]  [Export CSV]  [Deselect All]
```

**Behavior:**
- Overrides current filters
- Pushes only selected contacts
- Same modal flow as "Push All"

---

## Phoneburner Session Management in SourceCo

### Session Tracking Dashboard

**New page:** `/integrations/phoneburner/sessions`

**Purpose:** View all active dial sessions, monitor progress, track performance

```
┌─────────────────────────────────────────────────────────────────┐
│  Phoneburner Dial Sessions                          [+ New Session]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 Active Sessions (3)                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  PE Buyers - Feb 2026 Outreach                            │ │
│  │  88 contacts • 23 dialed • 14 connected • 5 qualified     │ │
│  │  Last activity: 15 min ago • Sarah Johnson                │ │
│  │  [View in Phoneburner]  [Add More Contacts]  [View Stats] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Seller Outreach - Collision Repair Owners                │ │
│  │  156 contacts • 87 dialed • 34 connected • 12 interested  │ │
│  │  Last activity: 1 hour ago • Mike Chen                    │ │
│  │  [View in Phoneburner]  [Add More Contacts]  [View Stats] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⏸️ Paused Sessions (1)                           [Show All]   │
│                                                                 │
│  ✅ Completed Sessions (8)                         [Show All]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Session Actions:**
- **Add More Contacts:** Re-opens list builder, adds to existing session
- **View Stats:** Session-level analytics (connection rate, talk time, dispositions)
- **View in Phoneburner:** Deep link to Phoneburner app

---

### Session Detail Page

**URL:** `/integrations/phoneburner/sessions/{session_id}`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Sessions                                             │
│                                                                 │
│  PE Buyers - Feb 2026 Outreach                    [⚙️ Settings] │
│  Created by Sarah Johnson • Feb 20, 2026                        │
│                                                                 │
│  📊 Performance                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  Total Contacts: 88     Dialed: 23      Connected: 14      ││
│  │  Connection Rate: 60.9%    Talk Time: 2h 15m               ││
│  │  Qualified: 5      Meetings Set: 2      Disqualified: 4    ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  📋 Contacts in Session                [+ Add Contacts] [Export]│
│  ┌────────────────────────────────────────────────────────────┐│
│  │  Name               Company            Status    Last Call  ││
│  │  ─────────────────────────────────────────────────────────││ 
│  │  ✅ John Smith      Heritage Capital   Connected  2h ago   ││
│  │  ✅ Emily Chen      Summit Partners    Connected  3h ago   ││
│  │  ⏳ Michael Brown   KKR                Pending    -        ││
│  │  ⏳ Sarah Davis     TPG                Pending    -        ││
│  │  ... [85 more]                                              ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  📞 Recent Activity                                             │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  2h ago • Sarah called John Smith (Heritage Capital)       ││
│  │           ✅ Connected • 3:42 talk time                     ││
│  │           📝 Interested - Send collision repair deal memo   ││
│  │                                                             ││
│  │  3h ago • Sarah called Emily Chen (Summit Partners)        ││
│  │           ✅ Connected • 5:18 talk time                     ││
│  │           📅 Meeting scheduled for March 5                  ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Notes

### API Flow: Push List to Phoneburner

**Step 1: User clicks "Push to Dialer"**
```javascript
// Frontend validates list
const validation = await validateContactsForPush(selectedContactIds);

// Show modal with validation results
showPushModal({
  readyToPush: validation.valid,
  excluded: validation.excluded,
  estimatedDialTime: calculateDialTime(validation.valid.length)
});
```

**Step 2: User configures session & clicks "Push"**
```javascript
// Build payload
const payload = {
  dial_session_id: selectedSession.phoneburner_id || null,
  create_session_if_missing: true,
  session_config: {
    name: sessionName,
    description: generateDescription(selectedContacts)
  },
  contacts: selectedContacts.map(contact => ({
    // Standard fields
    first_name: contact.first_name,
    last_name: contact.last_name,
    phone: formatPhoneE164(contact.phone),
    email: contact.email,
    company: contact.company,
    
    // Custom fields (all the context)
    custom_fields: {
      sourceco_contact_id: contact.id,
      contact_type: contact.type,
      buyer_type: contact.buyer_type,
      aum: contact.aum,
      target_sectors: contact.target_industries?.join(', '),
      last_contact_date: contact.last_call_attempt_at,
      engagement_score: contact.call_engagement_score,
      call_talking_points: generateTalkingPoints(contact),
      // ... more context fields
    }
  })),
  options: {
    skip_duplicates: options.skipDuplicates,
    update_existing: options.updateExisting
  }
};

// Make API call
const response = await phoneburnerAPI.pushContacts(payload);
```

**Step 3: Process response & update UI**
```javascript
if (response.success) {
  // Log the push in phoneburner_sessions table
  await db.phoneburner_sessions.upsert({
    phoneburner_session_id: response.dial_session_id,
    session_name: sessionName,
    total_contacts_added: response.contacts_added,
    created_by_user_id: currentUser.id,
    // ... more metadata
  });
  
  // Update contacts table
  await db.contacts.updateMany(
    { id: { in: selectedContactIds } },
    { 
      phoneburner_contact_id: response.contact_mappings,
      phoneburner_last_sync_at: new Date()
    }
  );
  
  // Show success message
  showSuccessToast({
    message: `${response.contacts_added} contacts pushed to Phoneburner`,
    actions: [
      { label: 'Open in Phoneburner', url: response.dial_session_url },
      { label: 'View Session', url: `/integrations/phoneburner/sessions/${response.dial_session_id}` }
    ]
  });
}
```

---

### Pre-Push Validation Logic

```javascript
async function validateContactsForPush(contactIds) {
  const contacts = await db.contacts.findMany({
    where: { id: { in: contactIds } },
    include: { last_activity: true }
  });
  
  const validation = {
    valid: [],
    excluded: {
      do_not_call: [],
      invalid_phone: [],
      recently_contacted: [],
      missing_required_fields: []
    }
  };
  
  for (const contact of contacts) {
    // Check 1: Do Not Call
    if (contact.do_not_call) {
      validation.excluded.do_not_call.push({
        contact,
        reason: contact.do_not_call_reason
      });
      continue;
    }
    
    // Check 2: Invalid Phone
    if (contact.phone_number_invalid || !contact.phone) {
      validation.excluded.invalid_phone.push({
        contact,
        reason: contact.phone_number_invalid ? 'Flagged as invalid' : 'Missing phone number'
      });
      continue;
    }
    
    // Check 3: Recently Contacted (configurable threshold)
    const daysSinceLastCall = daysBetween(contact.last_call_attempt_at, new Date());
    if (daysSinceLastCall < settings.min_days_between_calls) {
      validation.excluded.recently_contacted.push({
        contact,
        reason: `Called ${daysSinceLastCall} days ago`,
        lastCallDate: contact.last_call_attempt_at
      });
      continue;
    }
    
    // Check 4: Required Fields
    if (!contact.first_name || !contact.last_name) {
      validation.excluded.missing_required_fields.push({
        contact,
        reason: 'Missing first or last name'
      });
      continue;
    }
    
    // Passed all checks
    validation.valid.push(contact);
  }
  
  return validation;
}
```

---

### Smart Session Naming

```javascript
function generateSessionName(contacts, filters) {
  const components = [];
  
  // Contact type
  const contactTypes = [...new Set(contacts.map(c => c.type))];
  if (contactTypes.length === 1) {
    components.push(contactTypes[0] === 'buyer' ? 'Buyers' : 'Sellers');
  }
  
  // Buyer type (if all same)
  if (contactTypes[0] === 'buyer') {
    const buyerTypes = [...new Set(contacts.map(c => c.buyer_type))];
    if (buyerTypes.length === 1) {
      components.push(buyerTypes[0]);
    }
  }
  
  // Industry (if filtered)
  if (filters.industry) {
    components.push(filters.industry);
  }
  
  // Geography (if filtered)
  if (filters.state || filters.region) {
    components.push(filters.state || filters.region);
  }
  
  // Date
  const month = new Date().toLocaleString('default', { month: 'short' });
  const year = new Date().getFullYear();
  components.push(`${month} ${year}`);
  
  return components.join(' - ');
}

// Examples:
// "Buyers - PE Firm - Business Services - Northeast - Feb 2026"
// "Sellers - Collision Repair - Feb 2026"
// "Buyers - Feb 2026"
```

---

## User Training & Best Practices

### Rep Training Checklist

**Module 1: Building Lists (5 min)**
- How to filter contacts in SourceCo
- Using "Dialable Only" toggle
- Understanding exclusion warnings
- Reviewing list before push

**Module 2: Pushing to Phoneburner (5 min)**
- Clicking "Push to Dialer" button
- Selecting vs. creating dial sessions
- Understanding push options (skip recently contacted, etc.)
- Monitoring push progress

**Module 3: Context in Phoneburner (5 min)**
- Where to find SourceCo context in Phoneburner UI
- Using custom fields during calls (talking points, deal history)
- Best practices for efficient dialing

**Module 4: Session Management (5 min)**
- Viewing active sessions in SourceCo
- Adding more contacts to existing sessions
- Tracking session performance

---

### Best Practices Documentation

**When to Create New Session vs. Add to Existing:**
- **New Session:** Different campaign objective (buyer outreach vs. seller prospecting)
- **Add to Existing:** Same campaign, just adding more contacts (weekly batch additions)

**Recommended Push Frequency:**
- **Buyer Lists:** Weekly batches (e.g., every Monday morning)
- **Seller Lists:** Bi-weekly or per-deal basis
- **Callback Lists:** Daily (contacts with scheduled callbacks)

**Optimal List Size:**
- **50-100 contacts:** 1-2 day calling campaign
- **100-200 contacts:** Full week campaign
- **200+ contacts:** Split into multiple sessions by priority tier

---

## Success Metrics (Track These)

### Efficiency Metrics
- **Time to push list:** Measure from filter applied → contacts in Phoneburner
  - **Target:** <60 seconds
  - **Baseline:** 10-15 minutes (manual CSV export)

- **Lists pushed per week:** Track adoption
  - **Target:** 3+ lists/rep/week
  - **Indicates:** Feature is valuable and being used

### Data Quality Metrics
- **% contacts with valid phone numbers:** Should be >95%
  - Track: Contacts flagged as "invalid phone" after first call attempt
  
- **% contacts excluded for "recently contacted":** Should be 10-20%
  - Too high: Lists not being refreshed
  - Too low: Risk of contact fatigue

### Business Impact Metrics
- **Connection rate:** Compare before/after integration
  - **Hypothesis:** Better data quality → higher connection rate
  
- **Average list prep time:** Track time saved
  - **Target:** 90% reduction (15 min → 1.5 min)

---

## Mobile Responsiveness

### Mobile UX Considerations

**List Builder on Mobile:**
- Simplified filter interface (fewer options visible)
- "Dialable Only" as default toggle
- Single-tap "Push to Dialer" from contact cards

**Push Modal on Mobile:**
- Vertical layout (session selection at top)
- Collapsible exclusion details
- Larger tap targets

**Session Management:**
- Swipe actions on session cards (View, Add Contacts, Delete)
- Quick stats visible without tapping into session

---

## This Feature Solves

✅ **Manual CSV export/import workflow** → One-click push  
✅ **Lost context in transfer** → All data flows to Phoneburner custom fields  
✅ **Contact fatigue from duplicate calls** → Smart exclusion rules  
✅ **Blind dialing** → Reps see talking points, deal history in Phoneburner  
✅ **Scattered session management** → Centralized tracking in SourceCo  
✅ **Time waste** → 15 min/day saved per rep (120 hours/month team-wide)  

---

**Next Step:** Build frontend prototype of push modal for UX validation with 2-3 pilot reps.
