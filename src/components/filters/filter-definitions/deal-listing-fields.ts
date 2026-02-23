import {
  Building2,
  DollarSign,
  MapPin,
  Tag,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Star,
  Briefcase,
  Hash,
} from "lucide-react";

import type { FilterFieldDef } from "./types";

/** ReMarketing Deals / Admin Listings – shared fields */
export const DEAL_LISTING_FIELDS: FilterFieldDef[] = [
  // Core
  {
    key: "title",
    label: "Deal Name",
    type: "text",
    group: "Core",
    icon: Building2,
  },
  {
    key: "internal_company_name",
    label: "Company Name",
    type: "text",
    group: "Core",
    icon: Building2,
  },
  {
    key: "deal_source",
    label: "Deal Source",
    type: "select",
    group: "Core",
    icon: Tag,
    dynamicOptions: true,
  },
  {
    key: "referral_partner",
    label: "Referral Partner",
    type: "select",
    group: "Core",
    icon: Users,
    dynamicOptions: true,
    accessor: (item: any) => item.referral_partners?.name || null,
  },

  // Status
  {
    key: "status",
    label: "Status",
    type: "select",
    group: "Status",
    icon: Activity,
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  },
  {
    key: "status_tag",
    label: "Status Tag",
    type: "select",
    group: "Status",
    icon: Tag,
    dynamicOptions: true,
  },
  {
    key: "is_priority_target",
    label: "Priority Target",
    type: "boolean",
    group: "Status",
    icon: Star,
  },
  {
    key: "enrichment_status",
    label: "Enrichment Status",
    type: "select",
    group: "Status",
    icon: Activity,
    dynamicOptions: true,
  },

  // Financial
  {
    key: "revenue",
    label: "Revenue",
    type: "currency",
    group: "Financial",
    icon: DollarSign,
  },
  {
    key: "ebitda",
    label: "EBITDA",
    type: "currency",
    group: "Financial",
    icon: DollarSign,
  },

  // Business
  {
    key: "category",
    label: "Industry / Category",
    type: "select",
    group: "Business",
    icon: Briefcase,
    dynamicOptions: true,
  },
  {
    key: "linkedin_employee_range",
    label: "Employee Size",
    type: "select",
    group: "Business",
    icon: Users,
    dynamicOptions: true,
  },

  // Location
  {
    key: "address_state",
    label: "State",
    type: "select",
    group: "Location",
    icon: MapPin,
    dynamicOptions: true,
  },
  {
    key: "location",
    label: "Location",
    type: "text",
    group: "Location",
    icon: MapPin,
  },

  // Scoring
  {
    key: "deal_total_score",
    label: "Total Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "deal_quality_score",
    label: "Quality Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "seller_interest_score",
    label: "Seller Interest Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "google_rating",
    label: "Google Rating",
    type: "number",
    group: "Scoring",
    icon: Star,
  },
  {
    key: "google_review_count",
    label: "Google Reviews",
    type: "number",
    group: "Scoring",
    icon: Hash,
  },

  // Admin
  {
    key: "deal_owner_id",
    label: "Deal Owner",
    type: "user",
    group: "Admin",
    icon: Users,
  },
  {
    key: "created_at",
    label: "Created Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
  {
    key: "enriched_at",
    label: "Enriched Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
];

/** Admin Listings page adds a few extra fields on top of the shared set */
export const ADMIN_LISTING_FIELDS: FilterFieldDef[] = [
  ...DEAL_LISTING_FIELDS,
  {
    key: "visible_to_buyer_types",
    label: "Buyer Visibility",
    type: "multi_select",
    group: "Visibility",
    icon: Users,
    options: [
      { label: "Private Equity", value: "privateEquity" },
      { label: "Corporate", value: "corporate" },
      { label: "Family Office", value: "familyOffice" },
      { label: "Search Fund", value: "searchFund" },
      { label: "Individual", value: "individual" },
      { label: "Independent Sponsor", value: "independentSponsor" },
      { label: "Advisor/Banker", value: "advisor" },
      { label: "Business Owner", value: "businessOwner" },
    ],
  },
  {
    key: "acquisition_type",
    label: "Acquisition Type",
    type: "select",
    group: "Business",
    icon: Briefcase,
    options: [
      { label: "Add-on", value: "add_on" },
      { label: "Platform", value: "platform" },
    ],
  },
];
