

# Real Marketplace Data Strategy for Globe Visualization

## The Problem

You're absolutely right. The current metrics are borrowed from generic SaaS analytics and don't fit your M&A deal marketplace:

| Current Metric | Why It Doesn't Fit |
|----------------|-------------------|
| **Conversion Likelihood (15%)** | Generic algorithmic guess. M&A deals take months, not sessions. A "15%" conversion means nothing for deal flow. |
| **Estimated Value ($5.00)** | Arbitrary dollar value based on buyer type. Meaningless in a context where deals are worth millions. |
| **"Est. $2745"** aggregate | Sum of fake per-visitor values. Provides zero actionable insight. |

---

## Part 1: Real Data Already Available

Looking at your `EnhancedActiveUser` type and database schema, you already capture **rich, actionable M&A buyer intelligence**:

### User Profile Data
- `buyerType`: privateEquity, familyOffice, corporate, searchFund, independentSponsor, individual, advisor
- `companyName`: Real firm name
- `jobTitle`: Their role
- `deal_intent`: platform_only, platform_and_addons, primarily_addons
- `deploying_capital_now`: Active buyer signal
- `mandate_blurb`: What they're looking for

### Engagement Signals (Already Tracked)
- `listingsViewed`: How many deals they've looked at
- `listingsSaved`: Deals they've bookmarked (strong intent signal)
- `connectionsSent`: Connection requests to sellers (highest intent)
- `searchCount`: How actively they're searching

### Trust/Qualification Status
- `ndaSigned`: NDA completed (qualified buyer)
- `feeAgreementSigned`: Fee agreement signed (serious buyer)

---

## Part 2: Proposed Tooltip Card Redesign

Replace generic metrics with **real M&A buyer intelligence**:

```text
┌─────────────────────────────────────────┐
│ 🦊 ruby lynx                        ✕   │
│ 🇳🇱 Amsterdam, The Netherlands          │
│ 💻 Desktop  •  🌐 Chrome                │
├─────────────────────────────────────────┤
│ TRAFFIC SOURCE                          │
│ Referrer          🔗 Direct             │
│ Landing page      /marketplace          │
│ Session time      4 min 32 sec          │
│ Total visits      12                    │
├─────────────────────────────────────────┤
│ ENGAGEMENT  (new section)               │
│ Listings viewed   ▓▓▓▓▓▓░░░░  6         │
│ Listings saved    ▓▓░░░░░░░░  2         │
│ Connections sent  ▓░░░░░░░░░  1         │
├─────────────────────────────────────────┤
│ BUYER PROFILE  (for logged-in users)    │
│ Buyer type        🏢 Private Equity     │
│ NDA               ✅ Signed             │
│ Fee Agreement     ⏳ Pending            │
└─────────────────────────────────────────┘
```

### Rationale for Each Field

| Field | Why It Matters |
|-------|----------------|
| **Listings viewed** | Shows browsing depth. 6+ = actively hunting |
| **Listings saved** | Strong intent signal. Saved = considering seriously |
| **Connections sent** | Highest intent. They reached out to a seller |
| **Buyer type** | Instantly tells you who this person represents |
| **NDA / Fee Agreement** | Trust qualification status |

---

## Part 3: Proposed Floating Panel Redesign

Replace "(est. $2745)" with **actual buyer composition and activity**:

```text
┌─────────────────────────────────────────────────────┐
│ ● 28 visitors on marketplace                        │
│                                                     │
│ REFERRERS    🔍 Google 8  🔗 Direct 10  💼 LinkedIn 4 │
│                                                     │
│ COUNTRIES    🇭🇺 Hungary 19  🇳🇱 Netherlands 3  🇺🇸 USA 2 │
│                                                     │
│ DEVICES      💻 Desktop 25  📱 Mobile 3             │
├─────────────────────────────────────────────────────┤
│ BUYER BREAKDOWN  (new section)                      │
│ 🔒 Logged in             12 (43%)                   │
│ ✅ NDA Signed             8                         │
│ 📄 Fee Agreement          5                         │
│ 💬 Connection Requests    3 this hour               │
└─────────────────────────────────────────────────────┘
```

### Why This Is Better

| New Metric | Actionable Insight |
|------------|-------------------|
| **Logged in (%)** | Tells you if visitors are registered buyers vs. anonymous tire-kickers |
| **NDA Signed** | Qualified buyers currently browsing - high priority |
| **Fee Agreement** | Most serious buyers on site right now |
| **Connection Requests this hour** | Real-time deal flow activity happening |

---

## Part 4: Implementation Changes

### Files to Modify

| File | Changes |
|------|---------|
| `MapboxTooltipCard.tsx` | Remove ConversionLikelihood and EstimatedValue. Add Engagement section with progress bars. Add Buyer Profile section. |
| `MapboxFloatingPanel.tsx` | Remove "(est. $X)". Add new "Buyer Breakdown" section showing logged-in %, NDA signed, fee agreements, connections this hour. |
| `MapboxGlobeMap.tsx` | Remove `calculateConversionLikelihood()` and `calculateEstimatedValue()` functions. Pass real engagement data to tooltip. |

### New Aggregate Metrics to Calculate

```typescript
// In MapboxGlobeMap.tsx or passed from parent
const buyerBreakdown = useMemo(() => {
  const loggedInUsers = users.filter(u => !u.isAnonymous);
  return {
    loggedInCount: loggedInUsers.length,
    loggedInPercent: Math.round((loggedInUsers.length / users.length) * 100),
    ndaSignedCount: loggedInUsers.filter(u => u.ndaSigned).length,
    feeAgreementCount: loggedInUsers.filter(u => u.feeAgreementSigned).length,
    connectionsThisHour: loggedInUsers.reduce((sum, u) => sum + u.connectionsSent, 0),
  };
}, [users]);
```

---

## Part 5: Summary of Changes

### Remove (Generic/Fake)
- ❌ `Conversion likelihood` bar and percentage
- ❌ `Estimated value` dollar amount  
- ❌ `(est. $X)` in floating panel header

### Add (Real Marketplace Data)
- ✅ **Engagement Progress Bars**: Listings viewed, saved, connections
- ✅ **Buyer Profile Section**: Buyer type badge, NDA status, Fee Agreement status
- ✅ **Buyer Breakdown Panel**: Logged-in %, qualified buyers (NDA/Fee), real-time connections

### Keep (Already Useful)
- ✅ Referrer with icon
- ✅ Current URL / Landing page
- ✅ Session time
- ✅ Total visits
- ✅ Countries, Devices breakdown

---

## Technical Notes

### Progress Bar Visual for Engagement

Small horizontal bars showing relative engagement:

```tsx
function EngagementBar({ value, max = 10 }: { value: number; max?: number }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-coral-400 to-coral-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{value}</span>
    </div>
  );
}
```

### Buyer Type Badge Colors

```typescript
const buyerTypeColors: Record<string, string> = {
  'privateEquity': 'bg-violet-500/20 text-violet-400',
  'familyOffice': 'bg-emerald-500/20 text-emerald-400', 
  'corporate': 'bg-blue-500/20 text-blue-400',
  'searchFund': 'bg-amber-500/20 text-amber-400',
  'independentSponsor': 'bg-cyan-500/20 text-cyan-400',
  'individual': 'bg-rose-500/20 text-rose-400',
  'advisor': 'bg-slate-500/20 text-slate-400',
};
```

