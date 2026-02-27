# How the Task System Works — SourceCo Platform

**For: Dan and the SourceCo team**
**Last updated: February 2026**

---

## What It Is

The task system is how SourceCo tracks every action item that comes out of daily standups, deal calls, and manual work. It has two modes:

1. **AI-extracted tasks** — The platform listens to your Fireflies call recordings, runs them through Claude, and pulls out action items automatically. These show up as "Awaiting Approval" until a lead signs off.

2. **Manual tasks** — Anyone on the team can create a task by hand and assign it to themselves or someone else.

Every task is tied to a deal (or can be). Every task has an owner, a due date, and a type.

---

## Where to Find Tasks

### Daily Tasks Dashboard

**Sidebar: "Daily Tasks"** — or go to `/admin/daily-tasks`

This is the main hub. When you land on the Admin Dashboard, it defaults to the Daily Tasks view. You'll see:

- **KPI cards at the top**: Open Tasks, Completed, Overdue, Completion Rate
- **Awaiting Approval section** (leadership only): AI-extracted tasks that need sign-off before they become active
- **My Tasks / All Tasks toggle**: Switch between just your tasks or the whole team's
- **Three task buckets**: Today & Overdue, Upcoming, Completed (toggle "Show Completed" to see done tasks)

Tasks are grouped by person — each person gets their own card showing their assigned tasks.

### Pipeline Deal Detail

When you're looking at a specific deal in the pipeline (`/admin/pipeline`), click a deal to open its detail view. The **Tasks tab** shows tasks specific to that deal. You can:

- Click "Add Task" to create a task directly on that deal
- Set title, description, priority (low/medium/high), assignee, and due date
- See task progress as a percentage bar at the top
- Change status via the three-dot menu: Open → In Progress → Resolved (or NA, Reopened)

---

## Creating a Task

### From the Daily Tasks Dashboard

1. Click the **"+ Add Task"** button (top right)
2. Fill in:
   - **Task Title** (required) — e.g., "Call the owner of Smith Manufacturing"
   - **Description** — optional context
   - **Assign To** — pick a team member from the dropdown
   - **Task Type** — choose from:
     - Contact Owner
     - Build Buyer Universe
     - Follow Up with Buyer
     - Send Materials
     - Update Pipeline
     - Schedule Call
     - Other
   - **Due Date** — defaults to today
   - **Deal Reference** — type a company name to link it
3. Click **"Add Task"**

### From a Deal Detail Page

1. Open any deal in the pipeline
2. Go to the **Tasks tab**
3. Click the **"Add Task"** bar
4. Fill in title, description, priority, assignee, due date
5. Click **"Create Task"**

---

## Working With Tasks

### Completing a Task

- **Checkbox**: Click the checkbox on any task card to mark it complete. You get a 5-second **Undo** button in case you clicked by accident.
- **From deal detail**: Use the three-dot menu → change status to "Resolved"

### Viewing Task Details

Click any task card to open the **detail popup**. This shows:

- Title and description
- Task type (color-coded badge)
- Status (Overdue / Completed / Awaiting Approval / Pending)
- **Assignee dropdown** — you can reassign right from the popup
- **Deal dropdown** — you can link/change the deal right from the popup
- Due date (shows "in 2 days", "3 days ago", etc.)
- Priority rank and score (if set)
- Pin indicator (if leadership pinned it)
- Link to the source standup transcript (if AI-extracted)

### Reassigning a Task

Two ways:
1. **From the task detail popup**: Change the "Assigned to" dropdown
2. **From the three-dot menu**: Click "Reassign" on any task card

### Editing a Task

Three-dot menu → **"Edit Task"** — change title, description, type, due date, etc.

### Pinning a Task (Leadership Only)

Leadership (owners/admins) can pin tasks to force them to the top of someone's list:
- Three-dot menu → **"Pin to Rank"**
- Add an optional reason for the pin
- Pinned tasks show an amber pin icon

### Deleting a Task

Three-dot menu → **"Delete"** → confirm in the dialog. This is permanent.

---

## AI-Extracted Tasks

When a standup call is recorded via Fireflies, the platform automatically:

1. Pulls the transcript
2. Runs it through Claude to extract action items
3. Creates tasks with status **"Awaiting Approval"**
4. Assigns a confidence score and task type

### Approving AI Tasks

**Leadership only.** When AI tasks arrive:

- They appear in an amber **"Awaiting Approval"** section at the top of the Daily Tasks dashboard
- Each task has an **"Approve"** button next to it
- There's also an **"Approve All"** button to approve everything at once
- Once approved, tasks move into the normal task list

AI tasks show a link to **"View Standup Transcript"** so you can verify what was said.

### How Priority Scoring Works

Every task gets an automatic priority score based on:

- **Deal stage** — later-stage deals (LOI, Due Diligence) score higher than early-stage (Sourced, Qualified)
- **Task type** — "Contact Owner" (90 pts) scores higher than "Update Pipeline" (30 pts)
- **Overdue status** — overdue tasks get boosted
- **Pinned status** — leadership pins override the algorithm

The score determines the order tasks appear in your list.

---

## Task Analytics

Click **"Analytics"** button (top right of Daily Tasks dashboard) or go to `/admin/daily-tasks/analytics`.

This shows:
- Completion rates over time
- Team member scorecards — who's completing tasks on time
- Task volume trends
- Meeting quality metrics — how well the AI extraction is working
- Breakdown by task type

Use the **timeframe selector** (top right) to change the date range: last 7 days, 30 days, 90 days, etc.

---

## The AI Chat Assistant

The remarketing chat (the floating chat panel on remarketing pages) can answer questions about deals, buyers, and universes. It's context-aware — if you're on a deal page, it knows which deal you're looking at.

Currently the chat handles deal/buyer questions. The v3.1 upgrade will add task-specific commands like:
- "What's on my plate today?"
- "Create a task to follow up with [buyer]"
- "Show me overdue tasks on [listing]"

---

## What's Coming (v3.1 Upgrade)

The task system is being upgraded. Here's what changes for you:

### You'll notice:
- **Task Inbox** — a new central `/tasks` route with tabs: My Tasks, Due Today, This Week, Overdue, Completed
- **Snooze** — push a task to tomorrow, next week, or a custom date
- **Task comments** — discuss tasks with your team instead of just a single notes field
- **Task templates** — "Start Deal Process" button on listing pages that auto-creates the standard checklist for each deal stage
- **Daily briefing emails** — 8am summary of what's due, what's overdue, and what AI suggested overnight
- **Notification preferences** — control what alerts you get and how
- **Deal signals** — AI will also flag deal risks and momentum (buyer pausing, seller hesitation, etc.) separately from tasks
- **Buyer follow-up cadence** — the system tracks when each buyer was last contacted and flags when they're overdue based on deal stage

### For leadership:
- **Team dashboard** — see all team members' task status, workload, and overdue breakdown in one view
- **Bulk operations** — select multiple tasks to reassign, close, or snooze at once
- **Escalation tiers** — tasks that stay overdue automatically escalate (visual warnings → email → leadership notification)
- **AI calibration dashboard** — see how well the AI extraction is performing and adjust thresholds

### Under the hood:
- Tasks will be linked to listings, deals, buyers, contacts (not just a free-text deal reference)
- Every change is logged in an activity audit trail
- AI tasks get tiered expiry instead of all expiring at 7 days
- Deduplication prevents the same task from being extracted twice from different calls

---

## Quick Reference

| Action | Where | How |
|---|---|---|
| See my tasks | Daily Tasks dashboard | Default view, or toggle "My Tasks" |
| See all team tasks | Daily Tasks dashboard | Toggle "All Tasks" |
| Create a task | Daily Tasks dashboard | "+ Add Task" button |
| Create a deal task | Pipeline → Deal detail → Tasks tab | "Add Task" bar |
| Complete a task | Any task card | Click the checkbox |
| Reassign a task | Task detail popup or three-dot menu | Change assignee dropdown |
| Approve AI tasks | Daily Tasks dashboard (leadership) | "Approve" or "Approve All" |
| View analytics | Daily Tasks → "Analytics" button | Top right of dashboard |
| Pin a task | Three-dot menu (leadership) | "Pin to Rank" |
| Link task to deal | Task detail popup | Change deal dropdown |
| View transcript source | Task detail popup | "View Standup Transcript" link |
