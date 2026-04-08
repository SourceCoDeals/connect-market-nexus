

# Clarify Approval Status vs Request Status Labels

## Problem

Two "Pending" labels appear on the same row: **"Pending"** (the connection request status) and **"Pending Approval"** (the user's marketplace approval status). They look similar and it's unclear what each refers to. Same issue with "Approved" — could mean the request was approved or the user is approved on the marketplace.

## Fix

Rename the marketplace approval badge labels to explicitly reference "Marketplace":

| Current Label | New Label |
|---|---|
| `✓ Approved` | `Mkt. Approved` |
| `Pending Approval` | `Mkt. Not Approved` |
| `Rejected` | `Mkt. Rejected` |

Add a small `User` icon prefix to visually differentiate these from the request status badges (which use a clock icon).

For "Pending Approval" specifically, change variant from `sent` (amber) to something more attention-grabbing — keep amber but use bolder text: **"Mkt. Not Approved"** makes it unambiguous this is about the user's marketplace account, not the request.

## Changes

| File | Change |
|---|---|
| `src/components/admin/ConnectionRequestRow.tsx` | ~Line 545-553: Update badge labels to `Mkt. Approved` / `Mkt. Not Approved` / `Mkt. Rejected`, add `User` icon inside badge |
| `src/components/admin/WebflowLeadDetail.tsx` | Same label updates for the matched profile card's approval badge |

