

# Email Design Overhaul: Ultra-Minimal, Premium Clean

## Problems Found

### 1. Wrapper still has visual clutter
- `border-bottom: 1px solid #E8E4DD` on header (divider between logo and body)
- `border-top: 1px solid #E8E4DD` on footer
- `border: 1px solid #E8E4DD` on the card itself
- `border-radius: 8px` on card (adds visual weight)
- These borders create unnecessary visual noise. Apple and Stripe emails use whitespace alone to separate sections.

### 2. One em dash remains in production email copy
- `grant-data-room-access` subject: `Data room open — Project ${name}`

### 3. Inline borders inside email bodies
- `send-deal-referral`: `border: 1px solid #E8E4DD` on deal card, `border-top` divider inside card
- `send-deal-alert`: `border: 1px solid #E8E4DD` on financial stat boxes
- `send-task-notification-email`: `border-top: 1px solid #E8E4DD` inside info box
- These add visual clutter inside the body content

### 4. Background tints on info boxes are fine but overused
- `#F7F6F3` boxes are acceptable but some emails stack multiple grey boxes, making the layout feel heavy

### 5. Some emails still have "heavy" formatting
- Bold labels like `<strong>Company:</strong>`, `<strong>Priority:</strong>` create a form-like appearance rather than a clean letter
- Multiple stacked `<p>` tags with `margin: 0 0 8px` create cramped layouts
- Some have `font-size: 18px; font-weight: 600` headings inside the body that compete with the content

## Plan

### Step 1: Redesign the shared wrapper for zero-border minimalism

Remove all borders from the wrapper:
- No border on the card table (remove `border: 1px solid`)
- No `border-bottom` on header (use spacing only)
- No `border-top` on footer (use spacing only)
- No `border-radius` on card (clean rectangle)
- Increase padding for breathing room (40px sides instead of 30px)
- Footer: just the copyright and unsubscribe in very light text, no divider

### Step 2: Clean all 31 edge function email bodies

For every function, apply these rules:
- Remove all `border:`, `border-top:`, `border-bottom:` from inline styles
- Replace bordered boxes with padding-only or background-only containers
- Replace `<strong>Label:</strong> Value` patterns with cleaner typography (lighter label, normal-weight value)
- Remove heading-style text inside bodies (no `font-size: 18px; font-weight: 600` pseudo-headers). The email should read like a letter.
- Fix the remaining em dash in `grant-data-room-access` subject
- Ensure every email body is minimal: greeting, 1-3 short paragraphs, optional info block, CTA, sign-off. Nothing more.

### Step 3: Update EmailCatalog.tsx preview HTML

Update the shared preview building blocks to match the new borderless design.

### Scope

This touches:
- 1 shared wrapper file
- ~20 edge function files (the ones with borders/heavy formatting)
- 1 catalog preview file

This is too large for a single response. I will complete it in 2 rounds:
- **Round 1**: Wrapper redesign + first 15 edge functions + catalog previews
- **Round 2**: Remaining edge functions

### Files changed
- `supabase/functions/_shared/email-template-wrapper.ts`
- ~20 edge function `index.ts` files
- `src/components/admin/emails/EmailCatalog.tsx`

