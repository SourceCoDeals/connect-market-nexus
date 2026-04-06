

# Fix: Approval System Message Content

## Problem

When an admin accepts a connection request, two emails fire:

1. **Approval email** (`send-connection-notification`, type `approval_notification`) — This is good. It says "Your introduction has been approved, here's what to expect."

2. **Message notification email** (`notify-buyer-new-message`) — This is the screenshot. It wraps the hardcoded system message: *"We have sent you a brief overview of the deal. Please let us know if you are still interested."*

The second email is bad because:
- The buyer already expressed interest (they requested the connection)
- "Please let us know if you are still interested" is backwards — they should be getting welcomed, not re-qualified
- It duplicates the approval email but with worse content
- It reads like a cold outreach follow-up, not a deal confirmation

## Root Cause

Line 91 in `useConnectionRequestActions.ts`:
```typescript
body: 'We have sent you a brief overview of the deal. Please let us know if you are still interested.',
```

This hardcoded message is sent as a `decision` type system message. Since it's an admin message, the `use-connection-messages.ts` hook (line 141) fires `notify-buyer-new-message`, which wraps it in an email.

## Strategy: What Should This Message Say?

At this point in the flow, the buyer:
- Has been browsing the marketplace
- Found a deal they liked
- Submitted a connection request
- Just got approved

The system message in the thread should serve as the **kickoff** of the deal conversation. It should:
1. Confirm their access is live
2. Tell them what they now have access to (data room, documents)
3. Set expectations for next steps (SourceCo facilitates intro to owner)
4. Feel like a personal welcome to the deal, not a robot notification

## Fix

### File: `src/components/admin/connection-request-actions/useConnectionRequestActions.ts`

**Line 91**: Replace the hardcoded message with something contextually appropriate:

```typescript
body: `Your introduction to ${listing?.title || 'this deal'} has been approved. You now have access to the deal overview and supporting documents in the data room. Our team will facilitate the introduction to the business owner - expect to hear from us within one business day. If you have any questions in the meantime, reply here.`,
```

This message:
- Confirms what just happened (approved)
- Tells them what's unlocked (data room access)
- Sets the next step expectation (intro to owner, 1 business day)
- Invites engagement (reply here)
- Matches the tone of the approval email without duplicating it

### Consider: Should the message notification email even fire for decision messages?

The approval email (`send-connection-notification`) already covers the notification. The system message email (`notify-buyer-new-message`) is a duplicate notification. Two options:

**Option A**: Fix the message content (above) and accept both emails. The approval email is "here's the process," the message notification is "here's your thread kickoff." They complement each other.

**Option B**: Skip the `notify-buyer-new-message` email for `decision` type messages, since the approval email already covers it.

I recommend **Option A** for now — fix the content so both emails are useful. The message email reinforces that there's an active thread they should check. If the user later reports "too many emails on approval," we can suppress `decision` type messages from triggering the notification.

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/connection-request-actions/useConnectionRequestActions.ts` | Replace hardcoded approval message on line 91 with contextual deal kickoff message |

One-line change. No edge function changes needed.

