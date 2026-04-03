

# Email System Overhaul: Design + Copy for All 42 Emails

## Scope Assessment

There are **31 edge function files** containing email HTML that all flow through `wrapEmailHtml()` in `_shared/email-template-wrapper.ts`, plus the **EmailCatalog.tsx** preview system. The work breaks into two layers:

1. **Shared wrapper redesign** (1 file) - affects all emails at once
2. **Per-function copy + body HTML** (31 files) - each needs individual attention
3. **Catalog preview update** (1 file) - reflects the new design

This is too large to do in a single response. I recommend splitting into 3 rounds.

---

## Round 1 (this response): Foundation + High-Priority Emails

### Step 1: Redesign the shared wrapper (`email-template-wrapper.ts`)

Current problems:
- Header uses plain text "SourceCo" in `#1a1a2e` background
- Uses `#e94560` red accent, `#f1f5f9` grey background
- Footer says "SourceCo Marketplace"
- Generic system font stack

New design (Apple/Stripe level):
- **Logo**: Use the actual SourceCo logo image from `https://cdn.prod.website-files.com/66851dae8a2c8c3f8cd9c703/66af956d372d85d43f02f481_Group%202%20(4)%20(1).png` in the header, rendered as an `<img>` tag (40px height), centered on white background with generous padding
- **No colored header bar**. Clean white header with logo only, separated by a 1px `#E8E4DD` hairline
- **Font**: `'Montserrat', 'Helvetica Neue', Arial, sans-serif` (matches website)
- **Body background**: `#FAFAF8` (warm off-white, not cold blue-grey)
- **Card background**: `#FFFFFF`
- **Text color**: `#1A1A1A` (primary), `#6B6B6B` (secondary)
- **CTA buttons**: `#000000` background, `#FFFFFF` text, `6px` border-radius, no extra colors
- **Footer**: `#9B9B9B` text, "SourceCo" only, no "Marketplace" or "Deals Inc." suffix. Simple copyright + unsubscribe
- **No box-shadow** on the card. Subtle `1px solid #E8E4DD` border instead
- **No emojis anywhere**

### Step 2: Overhaul copy in the first ~15 edge functions (highest-traffic emails)

For each function, I will:
- Remove all em dashes (`&mdash;`, ` — `) and replace with periods or restructured sentences
- Remove all emojis from subjects and body (e.g., `✨`, `🤝`, `🏢`, `📍`, `🏷️`)
- Make copy hyper-specific and direct
- Use short, clear sentences
- Remove filler phrases ("Great news!", "We're committed to finding you the right match")
- Keep sign-offs as "The SourceCo Team" (no em dash prefix)

**Round 1 functions** (user-facing, high-traffic):
1. `send-templated-approval-email` (NDA signed + unsigned variants)
2. `notify-buyer-rejection`
3. `send-marketplace-invitation`
4. `send-connection-notification` (3 variants)
5. `send-deal-alert`
6. `send-deal-referral`
7. `user-journey-notifications` (welcome, verified, approved, rejected)
8. `send-verification-success-email`
9. `password-reset`
10. `request-agreement-email` (NDA + Fee Agreement)
11. `grant-data-room-access`

### Step 3: Update EmailCatalog.tsx preview HTML

Update the shared `wrapperStart`/`wrapperEnd`/`ctaBtn`/`infoBox` building blocks to match the new design, so all 42 previews reflect the actual email appearance.

---

## Round 2 (next response): Remaining Edge Functions

Functions 12-22:
- `send-onboarding-day2`
- `send-onboarding-day7`
- `send-first-request-followup`
- `notify-buyer-new-message`
- `notify-admin-new-message`
- `send-owner-inquiry-notification`
- `send-owner-intro-notification`
- `notify-new-deal-owner`
- `notify-deal-reassignment`
- `send-memo-email`
- `approve-marketplace-buyer`

## Round 3 (final response): Admin/System + Catalog Sync

Functions 23-31:
- `enhanced-admin-notification`
- `send-user-notification`
- `send-feedback-notification`
- `send-contact-response`
- `send-task-notification-email`
- `send-data-recovery-email`
- `send-feedback-email`
- `send-simple-verification-email`
- `notify-deal-owner-change`
- Final pass on EmailCatalog.tsx to ensure all 42 previews show exact copy

---

## Design Reference

```text
+------------------------------------------+
|                                          |
|           [SourceCo Logo 40px]           |
|                                          |
+------------------------------------------+  <- 1px #E8E4DD
|                                          |
|  Subject as H1                           |
|  18px, #1A1A1A, Montserrat 600           |
|                                          |
|  Body text                               |
|  15px, #1A1A1A, line-height 1.7          |
|                                          |
|  Callout box (when needed):              |
|  #F7F6F3 background, no colored border   |
|                                          |
|         [ CTA Button ]                   |
|         #000 bg, #FFF text               |
|                                          |
|  Closing line                            |
|  The SourceCo Team                       |
|                                          |
+------------------------------------------+  <- 1px #E8E4DD
|  (c) 2026 SourceCo                       |
|  Unsubscribe                             |
+------------------------------------------+
```

Background: `#FAFAF8`. Card: `#FFFFFF`. All text: black or `#6B6B6B` secondary.

---

## Summary

- **Round 1**: Redesign shared wrapper + overhaul 15 highest-traffic email functions + update catalog previews. This is what I will implement now.
- **Round 2**: Next 11 functions.
- **Round 3**: Final 9 functions + catalog sync.

All 42 emails will use the same minimal, black-and-white design with the real SourceCo logo. No emojis, no em dashes, no colored accents, no filler copy.

