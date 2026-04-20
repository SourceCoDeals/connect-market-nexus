# Task System — Phased Rollout Plan

_Companion to `TASK_SYSTEM_GUIDE.md`. Last updated 2026-04-20._

## Why this plan exists

The Task System is **built and running**, but **nobody is using it yet**. The infrastructure — Fireflies → AI → approval → dashboard — works end-to-end in testing. Standing it up for the team now is a people problem, not a technology problem.

This document is a short, phased plan for rolling it out in a way that builds trust and surfaces real-world issues before we commit the whole team to depending on it.

Read the **Task System Guide** first — it's the "what and how." This doc is the "when and in what order."

---

## Guiding principles

1. **Trust builds with small wins.** If the first week proves the pipeline works, adoption follows. If it produces garbage on day one, the team will never come back.
2. **Approver bandwidth is the choke point.** Nothing moves without leadership approval. A backlog of 80 pending tasks on day three will kill the rollout.
3. **Known limitations** _(see §6 of the guide)_ **must be called out, not hidden.** Specifically: no email notifications yet. People have to actively open the dashboard. Plan for it.
4. **Each phase has exit criteria.** Don't advance on a calendar — advance on behaviour.

---

## Current state (entry conditions)

- [x] Dashboard deployed and reachable at `/admin/remarketing/daily-tasks`.
- [x] AI extraction pipeline live (Gemini 2.0 Flash via OpenRouter, fallback to Fireflies native).
- [x] Cron safety net runs 4×/day.
- [x] Overdue-checker cron scheduled.
- [ ] **Nominated approver.** ← _do this first._
- [ ] **Team-member alias table populated** (names used in standups mapped to user profiles). A missing alias means unassigned tasks.
- [ ] **Team read the guide.** Ideally in a 30-min session, not async.

---

## Phase 1 — Foundation (Week 1)

**Goal:** prove the pipeline fires end-to-end for one meeting, with one approver, to one small group. No commitment yet — this is a smoke test.

**Actions:**

- Designate the approver (and a backup). Confirm they have the right dashboard permissions.
- Pick **one** recurring standup. Add `<ds>` to its Fireflies title _before_ the next occurrence.
- Populate `team_member_aliases` for every speaker likely to appear in that standup.
- Run that standup normally. Don't tell the team anything's different.
- The approver reviews the pending-approval queue within the same day.

**Success looks like:**

- Tasks appear in the queue within an hour of the meeting ending.
- Evidence quotes make sense — a human can tell why the AI drafted each task.
- Approver spends < 10 minutes reviewing.
- At most 1–2 "obvious nonsense" items that need dismissal.

**Do NOT advance if:**

- Zero tasks extracted (check §6 of the guide — usually the tag).
- More than 30% of drafts are nonsense (the AI is confused by your meeting format; probably fixable by tightening how commitments are stated in the standup).
- The cron fallback ran and webhook didn't — engineering needs to look before we trust it.

**Duration:** 3–5 business days.

---

## Phase 2 — Pilot (Weeks 2–3)

**Goal:** prove people will _work from the dashboard_ when the tasks are real.

**Actions:**

- Recruit **2–3 volunteers** (ideally: the approver + one ops person + one deal person). They commit to:
  - Opening `/admin/remarketing/daily-tasks` **once every morning**.
  - Working from it — not from memory, not from Slack DMs, not from the Fireflies summary.
  - Completing tasks in the UI (not just mentally).
  - Flagging anything weird.
- Keep tagging the same standup daily. Approver reviews within 24 h.
- Hold a **15-min retro at the end of Week 2**: what's useful, what's noise, what's missing.

**Success looks like:**

- Pilot users check the dashboard without being reminded.
- > 70% of approved tasks get completed within their due date.
- Zero complaints of "I had no idea I had a task" _beyond_ the known no-email-notifications gap.
- Approver queue stays < 15 items at any time.

**Watch for:**

- **Silent misses.** A standup happens, tag is present, but no tasks appear. Check the Standups tab — if the meeting is listed with `tasks_extracted = 0`, the AI didn't find commitments. If it's not listed at all, escalate to engineering.
- **Approval latency.** If approvals consistently take > 24 h, the queue becomes stale — assignees can't start work promptly. Consider multiple approvers or narrower approval criteria.
- **Speaker alias gaps.** New joiners or name variations land as unassigned. Update the alias table weekly.

**Duration:** 10 business days.

---

## Phase 3 — Ops team rollout (Weeks 4–6)

**Goal:** the entire ops team works from the dashboard daily. Escalation starts to bite.

**Actions:**

- Announce the rollout in writing (link to the guide, explicitly call out §6 limitations).
- Tag **every** relevant recurring standup (not just the pilot one).
- Populate aliases for the full team.
- Turn on escalation expectations formally: a task overdue by 3+ days = manager conversation.
- Add a **weekly 10-min team review** of overdue-task counts by person (in the Analytics view).

**Success looks like:**

- 80%+ completion rate across the team.
- < 5 overdue per person on any given day.
- Dashboard has replaced at least one side-channel (Slack DMs, post-its, personal notebooks) for committed work.
- Approver spends < 15 min/day on the queue.

**Watch for:**

- **Backlog fatigue.** If people have > 15 open tasks, the dashboard becomes overwhelming and they stop using it. Intervene with aggressive snoozing/reassigning before it tips.
- **"Tasks I didn't commit to."** Means the AI is over-extracting. Tighten standup language or tighten the approval bar.
- **Missed meetings.** Any untagged standup this far in is a trust leak. Build the tag into the recurring calendar invite template.

**Duration:** ~3 weeks of steady-state before declaring done.

---

## Phase 4 — Full team + decision on the gaps (Week 7+)

**Goal:** everyone uses it, _and_ leadership decides which limitations to fund fixing.

**Actions:**

- Onboard remaining team members (business dev, listing ops, anyone touching deals/buyers).
- Run a structured review of §6 limitations. For each one, decide:
  - **Fix now** (schedule engineering work)
  - **Workaround** (e.g. a Slack nudge for task assignments until email notifications ship)
  - **Accept** (live with it — mobile view is probably this)
- Revisit whether the `<ds>`-only filter still makes sense, or whether we want extraction from buyer/seller calls too.
- Re-evaluate the approval model: does every AI task still need human review, or can high-confidence tasks auto-approve?

**Decision points (not defaults):**

- Wire up email notifications? _(Deferred by decision — team is fine working from the dashboard for now.)_
- Extract tasks from non-standup meetings? _(Planned as a follow-on project — probably a `<bc>` / `<sc>` tag scheme mirroring `<ds>`.)_
- Auto-complete "Send NDA" tasks when PandaDoc signs the document? _(Not yet built. Simple DB trigger on `deals.nda_status` change — worth picking up if manual closing becomes a recurring miss.)_
- Shorten or retire the AI approval step for high-confidence tasks? _(Only consider after at least 4 weeks of steady-state approval data.)_

**Success means:**

- Task dashboard is the default, unquestioned home for committed work.
- Leadership has an informed, written decision on each major limitation.
- This rollout plan can be archived.

---

## Red flags that should pause the rollout at any phase

- **Approver goes on leave without a backup** → queue fills, nothing advances, trust collapses. Always have two.
- **Recurring false positives on the same person/deal** → AI is mis-matching aliases or deal names. Fix the alias / known-deal table before continuing.
- **Meetings repeatedly missing the tag** → cultural problem, not a technology problem. Fix the calendar invite template.
- **Team members saying "I got surprised by an overdue task"** while notifications are still unwired → we warned them, and it's still a real problem. Consider a daily digest script as a stopgap.
- **Pending-approval queue > 30 items at any point** → approval is not keeping up. Add an approver or raise the bar.

---

## Roles

| Role                    | Responsibility                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Approver**            | Reviews pending tasks within 24 h. Dismisses nonsense. Maintains the alias table. |
| **Backup approver**     | Covers when primary is out. Never "we'll catch up Monday."                        |
| **Rollout owner**       | Owns this plan. Runs the retros. Decides phase transitions.                       |
| **Engineering contact** | Fields reports of missing meetings, wrong extractions, webhook failures.          |
| **Every team member**   | Opens the dashboard daily. Works tasks to completion. Flags what isn't working.   |

Fill these roles **before Phase 1**, not during.

---

## Single-page summary

| Phase                           | Who                 | Duration | Advance when                                                         |
| ------------------------------- | ------------------- | -------- | -------------------------------------------------------------------- |
| **1. Foundation**               | Approver + one team | 3–5 days | One meeting produces sensible tasks, approver workflow works         |
| **2. Pilot**                    | 2–3 volunteers      | 2 weeks  | Pilot users self-serve the dashboard, > 70% completion               |
| **3. Ops rollout**              | Full ops team       | 3 weeks  | 80% completion, < 5 overdue/person, dashboard is the source of truth |
| **4. Full team + gap decision** | Everyone            | Ongoing  | Explicit decision on each §6 limitation                              |

---

_This plan assumes no major engineering work during rollout. If email notifications or the deal-activity timeline are shipped mid-rollout, revisit: those change how phases feel but not the order._
