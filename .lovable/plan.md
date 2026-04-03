

# Restructure Buyer Profile Panel — Slide-Over Instead of Inline Column

## Problem

The 260px inline column gets cut off at the viewport edge, text truncates everywhere ("Fee Agreen...", "Independent '..."), and it competes for horizontal space with the chat area. At 1251px viewport width, 320px list + chat + 260px panel = not enough room.

## Solution

Replace the fixed inline column with a **slide-over drawer** that overlays the chat area from the right. Hidden by default, toggled via the "Buyer Profile" button.

### Layout changes

**`src/pages/admin/message-center/ThreadView.tsx`**
- Default `showContext` to `false`
- Remove the inline `ThreadContextPanel` from the flex layout
- Instead, render it as a positioned overlay (absolute right-0, full height) with a backdrop click to close
- Chat area always gets full width

**`src/pages/admin/message-center/ThreadContextPanel.tsx`**
- Change width from `w-[260px]` to `w-[340px]` — more room for content since it's an overlay now
- Remove `hidden lg:flex` — visibility controlled by parent toggle
- Add a close button in the header
- Add shadow for overlay effect (`shadow-xl`)
- Accept an `onClose` callback prop

### Result
- Chat always uses full available width (~930px)
- Buyer Profile opens as a 340px overlay with proper shadow, text no longer truncates
- Click "Buyer Profile" button or close button to toggle
- No horizontal overflow issues

### Files changed
- `src/pages/admin/message-center/ThreadView.tsx` — default hidden, render as overlay
- `src/pages/admin/message-center/ThreadContextPanel.tsx` — wider, add close button, remove responsive hide

