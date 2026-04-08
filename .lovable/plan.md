

# Remove Inbound Leads Tab from Request Management

## What

Remove the "Inbound Leads" tab from the AdminRequests page. The DB table, AI Command Center tools, and backend references stay intact for historical querying.

## Changes

**`src/pages/admin/AdminRequests.tsx`**:
- Remove the `InboundLeadsTable` import (line 31)
- Remove `useInboundLeadsQuery`, `useMapLeadToListing`, `useConvertLeadToRequest`, `useArchiveInboundLead` imports and usages (lines 33-37, 55, 59-61)
- Remove the inbound leads realtime subscription channel (lines 217-230)
- Remove the `Inbox` icon import
- Convert `Tabs` from 2-column grid to a single tab (or remove `Tabs` wrapper entirely since there's only one tab left)
- Remove the `TabsTrigger` for "Inbound Leads" (lines 403-411)
- Remove the `TabsContent` for "inbound-leads" (lines 472-484)
- Update subtitle text from "Manage buyer connection requests and inbound leads" to "Manage buyer connection requests"

