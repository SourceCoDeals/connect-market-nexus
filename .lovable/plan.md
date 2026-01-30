

# Complete Analytics Integration: GA4, GTM & Third-Party Tools

## Current Status

**Implemented from Plan:**
- Referrer normalization bug fix (exact domain matching)
- GA4 helper library (`src/lib/ga4.ts`)
- Dual tracking to Supabase + GA4
- First-touch UTM attribution
- Landing page tracking

**Missing:**
- Real GA4 Measurement ID (still placeholder `G-XXXXXXXXXX`)
- Google Tag Manager
- Hotjar, Heap, LinkedIn, RB2B, Warmly, Brevo, Vector

---

## Implementation Plan

### Phase 1: Fix GA4 Measurement ID

**Files to update:**

| File | Change |
|------|--------|
| `index.html` | Replace `G-XXXXXXXXXX` with `G-N5T31YT52K` |
| `src/lib/ga4.ts` | Replace `G-XXXXXXXXXX` with `G-N5T31YT52K` |

### Phase 2: Add Google Tag Manager

GTM is the master container that can load GA4, Hotjar, LinkedIn, etc. - better than loading each individually.

**Add to `index.html` in `<head>`:**
```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NRP8FM6T');</script>
```

**Add to `<body>` right after opening:**
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NRP8FM6T"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

### Phase 3: Add Essential Third-Party Tools

**Priority Tools for B2B Marketplace:**

| Tool | Purpose | ID Provided |
|------|---------|-------------|
| Hotjar | Heatmaps, session recordings | `5092554` |
| Heap | Product analytics | `14631838` |
| LinkedIn Insight | B2B ads tracking | `4342364` |
| Brevo | Email marketing tracking | `5hvn11cin823nl7pp8l646lr` |
| RB2B | Company identification | `YE63P0H40KOW` |
| Warmly | Revenue intelligence | `997b5e51a2c8702d94f429354ad95723` |
| Vector | Intent data | `628e9b85-17e1-4942-bb91-06b7b5131f17` |

---

## Technical Implementation

### Updated `index.html` Structure

```html
<head>
  <!-- Existing meta tags... -->
  
  <!-- 1. Google Tag Manager (loads first - can manage other tags) -->
  <script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-NRP8FM6T');</script>
  
  <!-- 2. Google Analytics 4 (direct for reliability + cross-domain) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-N5T31YT52K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-N5T31YT52K', {
      linker: {
        domains: ['sourcecodeals.com', 'marketplace.sourcecodeals.com', 'market.sourcecodeals.com'],
        accept_incoming: true
      },
      cookie_domain: '.sourcecodeals.com',
      send_page_view: false
    });
  </script>
  
  <!-- 3. Heap Analytics -->
  <script>
    window.heapReadyCb=window.heapReadyCb||[];
    window.heap=window.heap||[];
    heap.load=function(e,t){...};
    heap.load("14631838");
  </script>
  
  <!-- 4. Hotjar -->
  <script>
    (function(h,o,t,j,a,r){
      h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
      h._hjSettings={hjid:5092554,hjsv:6};
      // ... rest of Hotjar code
    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
  </script>
  
  <!-- 5. LinkedIn Insight Tag -->
  <script>
    _linkedin_partner_id = "4342364";
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  </script>
  <script async src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>
  
  <!-- 6. RB2B (B2B Visitor Identification) -->
  <script>
    !function(){var reb2b=window.reb2b=window.reb2b||[];
    // ... RB2B code with key "YE63P0H40KOW"
  </script>
  
  <!-- 7. Warmly -->
  <script src="https://opps-widget.getwarmly.com/warmly.js?clientId=997b5e51a2c8702d94f429354ad95723" defer></script>
  
  <!-- 8. Brevo -->
  <script src="https://cdn.brevo.com/js/sdk-loader.js" async></script>
  <script>
    window.Brevo = window.Brevo || [];
    Brevo.push(["init", { client_key: "5hvn11cin823nl7pp8l646lr" }]);
  </script>
  
  <!-- 9. Vector -->
  <script>
    !function(e,r){...vector.load("628e9b85-17e1-4942-bb91-06b7b5131f17");}(window,document);
  </script>
</head>

<body>
  <!-- GTM noscript fallback -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NRP8FM6T" 
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  
  <!-- LinkedIn noscript pixel -->
  <noscript><img height="1" width="1" style="display:none;" alt="" 
    src="https://px.ads.linkedin.com/collect/?pid=4342364&fmt=gif" /></noscript>
  
  <div id="root"></div>
  <!-- ... existing scripts -->
</body>
```

---

## What You Need to Do in GA4 Admin

### Step 1: Add Marketplace as Data Stream

In your GA4 property (`G-N5T31YT52K`), go to:
1. Admin → Data Streams → Add Stream → Web
2. URL: `marketplace.sourcecodeals.com`
3. Stream name: "Marketplace"

This creates a unified view of sourcecodeals.com + marketplace in GA4.

### Step 2: Configure Cross-Domain Tracking in GA4

Go to: Admin → Data Streams → [Your Stream] → Configure tag settings → Configure your domains

Add all your domains:
- `sourcecodeals.com`
- `marketplace.sourcecodeals.com`
- `market.sourcecodeals.com`

### Step 3: Link GA4 to GSC (Google Search Console)

1. In GA4: Admin → Product Links → Search Console Links
2. Click "Link" and select your GSC property
3. This allows you to see organic search queries directly in GA4

---

## Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add GTM, update GA4 ID, add Hotjar, Heap, LinkedIn, RB2B, Warmly, Brevo, Vector |
| `src/lib/ga4.ts` | Update GA4_MEASUREMENT_ID constant to `G-N5T31YT52K` |

---

## What I Need From You (Confirmation)

All the IDs you provided are already in your message. I have everything needed:

| Tool | ID | Ready |
|------|-----|-------|
| GA4 | `G-N5T31YT52K` | Yes |
| GTM | `GTM-NRP8FM6T` | Yes |
| Hotjar | `5092554` | Yes |
| Heap | `14631838` | Yes |
| LinkedIn | `4342364` | Yes |
| RB2B | `YE63P0H40KOW` | Yes |
| Warmly | `997b5e51a2c8702d94f429354ad95723` | Yes |
| Brevo | `5hvn11cin823nl7pp8l646lr` | Yes |
| Vector | `628e9b85-17e1-4942-bb91-06b7b5131f17` | Yes |

The second GA4 ID (`G-JJX1ZG08ML`) in your snippets appears to be a duplicate - please confirm if both are needed or just `G-N5T31YT52K`.

---

## Expected Results After Implementation

1. **GA4**: Full cross-domain tracking between sourcecodeals.com and marketplace
2. **GTM**: Central tag management - easier to add/remove tools later
3. **Hotjar**: Heatmaps and session recordings for UX insights
4. **Heap**: Automatic event capture for product analytics
5. **LinkedIn**: Track conversions for LinkedIn Ads
6. **RB2B + Warmly**: Identify anonymous B2B visitors and their companies
7. **Brevo**: Track email campaign effectiveness
8. **Vector**: Intent data for sales intelligence

All tools will share the same user identity via GA4 cross-domain tracking and dataLayer events.

