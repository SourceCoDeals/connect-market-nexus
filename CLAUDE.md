# CLAUDE.md - AI Assistant Guide for Connect Market Nexus

This document provides comprehensive guidance for AI assistants working on the Connect Market Nexus codebase (SourceCo Deal Marketplace).

## Project Overview

**Connect Market Nexus** is a full-stack marketplace application for M&A deal sourcing and buyer-seller connections in the automotive aftermarket industry. Built with React, TypeScript, and Supabase, it enables deal brokers to manage listings, match buyers with acquisition opportunities, and facilitate introductions.

**Production URL**: https://marketplace.sourcecodeals.com
**Platform**: Lovable (Vercel's design-to-code platform)
**Supabase Project**: `vhzipqarkmmfuqadefep`

---

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.5.3** - Type-safe development
- **Vite 5.4.1** - Build tool and dev server
- **React Router v6** - Client-side routing
- **TanStack React Query v5** - Server state management
- **Tailwind CSS 3.4.11** - Utility-first styling
- **shadcn-ui** - Component library (Radix UI based)
- **Lucide React** - Icon library

### Backend
- **Supabase** - PostgreSQL database + Auth + Edge Functions
- **Deno** - Edge function runtime
- **PostgreSQL 15** - Database

### Notable Libraries
- **React Hook Form + Zod** - Form handling and validation
- **TipTap** - Rich text editor
- **Recharts** - Data visualization
- **Mapbox GL** - Geographic visualization
- **PapaParse** - CSV parsing
- **@dnd-kit** - Drag-and-drop functionality

---

## Quick Commands

```bash
# Development
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

---

## Directory Structure

```
/
├── src/
│   ├── App.tsx                 # Main routing configuration
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles + Tailwind
│   │
│   ├── components/             # React components (600+)
│   │   ├── admin/              # Admin dashboard components
│   │   │   ├── analytics/      # Analytics dashboards
│   │   │   ├── pipeline/       # Deal pipeline management
│   │   │   └── permissions/    # RBAC components
│   │   ├── remarketing/        # ReMarketing feature
│   │   ├── ma-intelligence/    # M&A Intelligence module
│   │   ├── ui/                 # shadcn-ui base components
│   │   ├── listing/            # Listing components
│   │   ├── auth/               # Authentication components
│   │   └── shared/             # Shared reusable components
│   │
│   ├── pages/                  # Page components
│   │   ├── admin/              # Admin pages
│   │   │   ├── remarketing/    # ReMarketing pages
│   │   │   └── ma-intelligence/# M&A Intelligence pages
│   │   └── auth/               # Auth callback handlers
│   │
│   ├── hooks/                  # Custom React hooks (40+)
│   │   ├── marketplace/        # Marketplace-specific hooks
│   │   ├── admin/              # Admin-specific hooks
│   │   └── permissions/        # Permission hooks
│   │
│   ├── context/                # React Context providers
│   │   ├── AuthContext.tsx     # Authentication state
│   │   ├── AnalyticsContext.tsx
│   │   └── SessionContext.tsx
│   │
│   ├── lib/                    # Utilities and helpers
│   │   ├── utils.ts            # General utilities (cn, etc.)
│   │   ├── error-handler.ts    # Error handling
│   │   ├── query-keys.ts       # React Query key factory
│   │   └── ma-intelligence/    # M&A module utilities
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── index.ts            # Core types (User, Listing, etc.)
│   │   ├── admin.ts            # Admin types
│   │   ├── remarketing.ts      # ReMarketing types
│   │   └── analytics.ts        # Analytics types
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Supabase client
│   │       └── types.ts        # Auto-generated DB types
│   │
│   └── config/                 # Feature configuration
│
├── supabase/
│   ├── config.toml             # Supabase configuration
│   ├── migrations/             # Database migrations (90+)
│   └── functions/              # Edge Functions (80+)
│       ├── _shared/            # Shared function utilities
│       ├── score-buyer-deal/   # AI scoring algorithm
│       ├── enrich-buyer/       # Buyer enrichment
│       ├── enrich-deal/        # Deal enrichment
│       └── ...
│
├── public/                     # Static assets
└── scripts/                    # Utility scripts
```

---

## Core Concepts and Domain Model

### User Types
- **Buyer**: Authenticated user seeking acquisition opportunities
  - Types: `corporate`, `privateEquity`, `familyOffice`, `searchFund`, `individual`, `independentSponsor`, `advisor`, `businessOwner`
- **Admin**: Internal staff managing the marketplace

### Key Entities
- **Listing**: A deal/acquisition opportunity with financials, location, categories
- **ConnectionRequest**: Buyer's request to connect with a listing
- **ReMarketing Buyer**: External buyer profile for deal matching (separate from marketplace users)
- **Universe**: A curated group of buyers with specific criteria for deal matching

### Approval Flow
1. User signs up → `approval_status: 'pending'`
2. Admin reviews → `approval_status: 'approved'` or `'rejected'`
3. Approved users can access the marketplace

---

## Code Conventions

### TypeScript
- **Path alias**: Use `@/` for imports from `src/` (e.g., `@/components/ui/button`)
- **Relaxed settings**: `noImplicitAny: false`, `strictNullChecks: false` - legacy codebase
- **Type definitions**: Core types in `src/types/index.ts`

### React Components
```typescript
// Component file structure
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ComponentProps {
  id: string;
  onSuccess?: () => void;
}

export function ComponentName({ id, onSuccess }: ComponentProps) {
  // Component implementation
}
```

### Custom Hooks Pattern
```typescript
// hooks/use-feature.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeature(id: string) {
  const query = useQuery({
    queryKey: ["feature", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_name")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return { ...query };
}
```

### Supabase Database Access
```typescript
// Always use the typed client
import { supabase } from "@/integrations/supabase/client";

// Queries
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("column", value);

// Mutations
const { data, error } = await supabase
  .from("table_name")
  .insert({ column: value })
  .select()
  .single();
```

### Edge Functions Pattern
```typescript
// supabase/functions/function-name/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Implementation
    const body = await req.json();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## Styling Guidelines

### Tailwind CSS
- Use SourceCo brand colors: `sourceco`, `sourceco-accent`, `sourceco-muted`
- Status colors: `success`, `info`, `warning`, `destructive`
- Use semantic spacing: `section`, `card`, `element`, `compact`, `tight`
- Primary font: Inter

### shadcn-ui Components
- All base UI components in `src/components/ui/`
- Import from: `@/components/ui/component-name`
- Follow Radix UI accessibility patterns

### Color Tokens
```css
/* Brand Colors */
--sourceco-primary        /* Gold accent #d7b65c */
--sourceco-accent
--sourceco-muted
--sourceco-background
--sourceco-form

/* Status Colors */
--success, --info, --warning, --destructive
--status-required, --status-sent, --status-completed
```

---

## Key Features by Module

### Marketplace (User-facing)
- **Listings**: Browse, search, filter acquisition opportunities
- **Connection Requests**: Request introduction to listing owners
- **Saved Listings**: Bookmark interesting opportunities
- **Profile**: Comprehensive buyer profile with investment criteria

### Admin Dashboard
- **User Management**: Approve/reject signups, manage permissions
- **Listing Management**: Create, edit, present deals
- **Pipeline**: Track deal stages and follow-ups
- **Analytics**: Session tracking, user journeys, geographic data

### ReMarketing Module (`/admin/remarketing/*`)
- **Universes**: Create buyer groups with specific criteria
- **Deal Matching**: AI-powered buyer-deal scoring
- **Bulk Import**: CSV import with duplicate detection
- **Introductions**: Manage buyer outreach

### M&A Intelligence (`/admin/ma-intelligence/*`)
- **Trackers**: Monitor deal sources
- **Buyer Universe**: Aggregate buyer intelligence
- **Deal Analysis**: AI-powered deal evaluation

---

## Database Schema Notes

### Key Tables
- `profiles` - User profiles (linked to Supabase auth.users)
- `listings` - Deal listings with financials and metadata
- `connection_requests` - Buyer-listing connection requests
- `remarketing_buyers` - External buyer profiles for matching
- `remarketing_buyer_universes` - Buyer group configurations
- `remarketing_scores` - AI-generated buyer-deal match scores
- `sessions` / `session_events` - Analytics tracking

### JSONB Fields
Many tables use JSONB for flexible data:
- `source_metadata` - Import source tracking
- `scoring_behavior` - Universe scoring configuration
- `deal_snapshot` - Point-in-time deal data for score staleness

---

## API and Edge Functions

### Authentication
- JWT-based auth via Supabase
- Token expiry: 3600s with refresh rotation
- Some functions require JWT (`verify_jwt = true` in config.toml)

### Key Functions
| Function | Purpose | Auth |
|----------|---------|------|
| `score-buyer-deal` | AI buyer-deal matching | JWT |
| `enrich-buyer` | AI buyer profile enrichment | JWT |
| `enrich-deal` | AI deal enrichment | JWT |
| `bulk-import-remarketing` | CSV import processing | JWT |
| `enhanced-email-delivery` | Email notifications | Public |
| `track-session` | Analytics tracking | Public |

### Calling Edge Functions
```typescript
const { data, error } = await supabase.functions.invoke("function-name", {
  body: { param: value }
});
```

---

## Testing and Development

### Local Development
1. `npm install`
2. Create `.env` with Supabase credentials
3. `npm run dev` - runs on port 8080

### Environment Variables
```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

### Error Handling
- Use `errorHandler` from `@/lib/error-handler.ts`
- Production errors tracked via `ErrorBoundary`
- Structured logging in `@/lib/logging/logger.ts`

---

## Important Patterns to Follow

### 1. React Query for Data Fetching
Always use React Query for server state - never raw `useEffect` + `fetch`:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["entity", id],
  queryFn: fetchFunction,
});
```

### 2. Form Handling
Use React Hook Form with Zod validation:
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });
const form = useForm({ resolver: zodResolver(schema) });
```

### 3. Toast Notifications
Use Sonner for toasts:
```typescript
import { toast } from "sonner";
toast.success("Operation completed");
toast.error("Something went wrong");
```

### 4. Protected Routes
Wrap routes requiring authentication:
```tsx
<Route element={<ProtectedRoute requireApproved={true}><Layout /></ProtectedRoute>}>
  <Route path="..." element={<Page />} />
</Route>
```

### 5. Admin-Only Features
Check `is_admin` before rendering admin features:
```typescript
const { user } = useAuth();
if (!user?.is_admin) return <Navigate to="/unauthorized" />;
```

---

## Common Gotchas

1. **Database column names**: Use snake_case (e.g., `first_name`, not `firstName`)
2. **User types aliasing**: Both `flex_subxm_ebitda` and `flex_subXm_ebitda` exist for compatibility
3. **Listing categories**: Array field `categories` with fallback to single `category`
4. **Edge function CORS**: Always include `corsHeaders` and handle OPTIONS requests
5. **Rate limiting**: AI functions have rate limits - check `_shared/security.ts`

---

## Deployment

- **Frontend**: Deployed via Lovable platform
- **Database**: Supabase managed PostgreSQL
- **Edge Functions**: Deploy via Supabase CLI or dashboard
- **Migrations**: Tracked in `supabase/migrations/`

---

## Getting Help

- Check existing hooks in `src/hooks/` for patterns
- Reference `src/types/index.ts` for type definitions
- Edge function examples in `supabase/functions/`
- UI component examples in `src/components/ui/`

---

*Last updated: February 2026*
