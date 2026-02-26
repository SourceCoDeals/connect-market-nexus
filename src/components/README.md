# Component Map — SourceCo Platform

> Last updated: 2026-02-26 (CTO Audit)

## Directory Structure

```
src/components/
├── admin/                    # Admin panel components
│   ├── CreateDealModal/      # Deal creation flow
│   ├── analytics/            # Analytics dashboards
│   ├── dashboard/            # Admin dashboard
│   ├── data-recovery/        # Data recovery tools
│   ├── data-room/            # Data room management
│   ├── deals/                # Deal management views
│   ├── document-distribution/# Document tracking
│   ├── editor-sections/      # Listing editor sections
│   ├── firm-agreements/      # NDA/fee agreement management
│   ├── form-monitoring/      # Form activity monitoring
│   ├── non-marketplace/      # Non-marketplace user views
│   ├── permissions/          # Team & permissions management
│   ├── pipeline/             # Deal pipeline views
│   │   ├── tabs/             # Pipeline tab components
│   │   │   └── task-management/  # Task management within pipeline
│   │   └── views/            # Pipeline view modes
│   └── users-table/          # User management tables
├── ai-command-center/        # AI chatbot interface
├── auth/                     # Authentication components
├── buyer/                    # Buyer-facing components
├── buyers/                   # Buyer management (admin-side)
├── common/                   # Shared utility components
├── connection/               # Connection request components
├── daily-tasks/              # Daily task management
├── deal-alerts/              # Deal alert notifications
├── deals/                    # Deal-related components
├── docuseal/                 # DocuSeal signing components
├── filters/                  # Filter system
│   ├── filter-definitions/   # Filter type definitions
│   └── value-inputs/         # Filter value input components
├── icons/                    # Custom icon components
├── layout/                   # Layout wrappers
├── listing/                  # Listing display components
├── listing-detail/           # Listing detail page components
├── ma-intelligence/          # M&A intelligence features
│   └── tracker/              # Intelligence tracker
├── marketplace/              # Marketplace components
├── navbar/                   # Navigation bar components
├── onboarding/               # User onboarding flow
├── realtime/                 # Real-time update components
├── remarketing/              # Remarketing pipeline components
│   ├── AIResearchSection/    # AI-powered research
│   ├── DealTranscriptSection/# Deal transcript views
│   ├── buyer-detail/         # Buyer detail sub-components
│   ├── csv-import/           # CSV import flow
│   ├── deal-detail/          # Deal detail sub-components
│   └── transcript/           # Transcript viewer
├── security/                 # Security components
├── settings/                 # Settings components
├── shared/                   # Shared/reusable UI components
├── transcripts/              # Transcript components
└── ui/                       # shadcn/ui base components
```

## Key Component Groups

### Admin Panel
The admin panel is the primary working interface for SourceCo team members. Key components:
- `AdminLayout.tsx` — Main admin page wrapper with sidebar
- `UnifiedAdminSidebar.tsx` — Sidebar navigation with domain-grouped sections
- `AdminNavbar.tsx` — Mobile admin navigation
- `ConnectionRequestsTable.tsx` — Buyer connection request management

### AI Command Center
- `AICommandCenterProvider.tsx` — Context provider for AI chat state
- Chat interface components for conversational AI interaction

### Remarketing
The remarketing pipeline is the core workflow for deal management:
- `ReMarketingDealDetail.tsx` — **Monolithic** deal detail page (1675 lines, 4 tabs)
- `ReMarketingDeals.tsx` — Deal list with filtering
- `ReMarketingBuyers.tsx` — Buyer management
- `ReMarketingUniverseDetail.tsx` — Buyer universe details

### Buyer-Facing
- `Navbar.tsx` — Main marketplace navigation
- `ListingCard.tsx` — Deal listing card display
- `BuyerMessages.tsx` — Buyer messaging interface

## Known Issues

1. **Monolithic components**: `ReMarketingDealDetail.tsx` (1675 lines) contains 4 tabs in a single file. Should be broken into sub-components per tab.
2. **Some pages have duplicate components**: Both a monolithic version and a directory-based version may exist for the same page. Always verify which is actively imported before editing.

## Shadow Component Rule

Before editing any page-level component, run:
```bash
grep -rn "ComponentName" src/ --include="*.tsx" --include="*.ts"
```
Confirm there is only ONE import in the router/parent. If two exist, identify which is live.
