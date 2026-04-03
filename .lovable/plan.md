

# Add Email Catalog Section to Email Dashboard

## What We're Building

A new "Email Catalog" section on the `/admin/emails` dashboard that shows every email the platform sends, organized by category, with the subject line, recipient type, trigger description, and the edge function that sends it.

This is a static reference catalog — not driven by live data, but a hardcoded registry of all 34+ email types so you can see the complete picture in one place.

## Implementation

### Single file change: `src/pages/admin/EmailDashboardPage.tsx`

Add a new tabbed section below the existing delivery log. Two tabs: **Delivery Log** (current content) and **Email Catalog** (new).

The catalog will be a grouped, searchable table with these columns:
- **Email Name** — human-readable name
- **Subject Line** — exact subject copy
- **Recipient** — who gets it (Buyer, Owner, Admin, etc.)
- **Trigger** — what causes it to send
- **Edge Function** — the function name (for internal reference)

### Categories (groups)

1. **Onboarding & Auth** (6 emails)
   - Signup confirmation (Supabase Auth built-in)
   - Email verification resolved — "Email Verified Successfully — What's Next"
   - Technical verification fix — "Email Verification - Technical Issue Resolved"
   - Password reset — "Reset Your Password — SourceCo"
   - Onboarding Day 2 — "Still exploring? Here's what to do next"
   - Onboarding Day 7 — day 7 re-engagement

2. **Buyer Lifecycle** (7 emails)
   - Marketplace approval — "Welcome to SourceCo Marketplace"
   - Marketplace invitation — "[Name], you're invited to SourceCo Marketplace"
   - Buyer rejection — "Update on Your Interest in [Deal]"
   - Connection request confirmation — user gets confirmation
   - Connection approval notification — buyer notified of approval
   - Deal alert — "New Match: [Deal Title]"
   - Deal referral — "[Referrer] shared a deal with you"

3. **Agreements & Documents** (3 emails)
   - NDA request — "NDA Required — [Deal]"
   - Fee agreement request — "Fee Agreement Required — [Deal]"
   - Data room access granted — "Data room open — Project [Name]"

4. **Deal & Owner Notifications** (5 emails)
   - New deal owner notification — "You've been assigned a new deal"
   - Deal reassignment — "Deal reassignment notification"
   - Owner inquiry notification — admin notified of owner inquiry
   - Owner intro notification — owner notified of buyer introduction
   - Memo email — custom subject (admin-composed)

5. **Messaging** (2 emails)
   - Buyer new message — "New message on [Deal]"
   - Admin new message — "New buyer message from [Buyer]"

6. **Admin & System** (6 emails)
   - New user registration (enhanced) — "New User Registration - Action Required"
   - Journey admin new user — admin notified of signup
   - Feedback notification — "[Category] Feedback from [User]"
   - Contact response — "Thank you for your [category] feedback"
   - Task notification — "[Task Title] assigned to you"
   - Data recovery — "Complete Your Profile - Missing Information"

7. **Platform Notifications** (3 emails)
   - User notification (generic) — dynamic subject
   - First request followup — "Quick update on your request"
   - Feedback email — custom admin reply

### UI Design

- Use the existing Tabs component to split "Delivery Log" and "Email Catalog"
- Each category rendered as a collapsible section with a count badge
- Search bar to filter across all categories
- Clean table layout matching the existing dashboard aesthetic
- Color-coded recipient badges (green=Buyer, blue=Admin, amber=Owner, gray=System)

### Technical Details

- All data is a static TypeScript array — no database queries needed
- Filterable by category and searchable by name/subject/function
- Sits in the same `EmailDashboardPage.tsx` file as a new component

