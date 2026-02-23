

## Remove Redundant Document & Message Previews from Overview Tab

The buyer's deal detail page (My Requests) currently has:
- **Tabs**: Overview, Documents, Messages
- **Inside the Overview tab**: Deal info card, Process Steps, then redundant "Documents" and "Messages" preview sections

Since Documents and Messages already have their own dedicated tabs, the preview sections in the Overview tab are unnecessary clutter. We will remove them.

### Changes

**File: `src/pages/MyRequests.tsx`**
- Remove the `DealDocumentPreview` section (lines 418-424) from the Overview tab
- Remove the `DealMessagePreview` section (lines 426-431) from the Overview tab
- Remove the corresponding imports for `DealDocumentPreview` and `DealMessagePreview` if they become unused

The Overview tab will then show only: Deal Metrics Card, Process Steps, and the "About this opportunity" Deal Details Card -- keeping it clean and non-redundant with the other tabs.
