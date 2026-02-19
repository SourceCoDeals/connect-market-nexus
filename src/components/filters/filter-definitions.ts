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
  Globe,
  type LucideIcon,
} from "lucide-react";

// ─── Field Types ────────────────────────────────────────────────
export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "select"
  | "multi_select"
  | "boolean"
  | "date"
  | "user";

// ─── Operators ──────────────────────────────────────────────────
export type Operator =
  // text
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  // number / currency
  | "eq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  // select
  | "is"
  | "is_not"
  | "is_any_of"
  // multi_select
  | "includes_any"
  | "includes_all"
  | "excludes"
  // boolean
  | "is_true"
  | "is_false"
  // date
  | "before"
  | "after"
  | "last_n_days"
  // user
  | "is_unassigned";

export interface OperatorDef {
  value: Operator;
  label: string;
  /** true if the operator needs no value input (e.g. is_empty, is_true) */
  noValue?: boolean;
  /** true if the operator needs two value inputs (e.g. between) */
  dual?: boolean;
}

export const OPERATORS_BY_TYPE: Record<FieldType, OperatorDef[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "gt", label: ">" },
    { value: "gte", label: ">=" },
    { value: "lt", label: "<" },
    { value: "lte", label: "<=" },
    { value: "between", label: "between", dual: true },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  currency: [
    { value: "eq", label: "=" },
    { value: "gt", label: ">" },
    { value: "gte", label: ">=" },
    { value: "lt", label: "<" },
    { value: "lte", label: "<=" },
    { value: "between", label: "between", dual: true },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  select: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "is_any_of", label: "is any of" },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  multi_select: [
    { value: "includes_any", label: "includes any of" },
    { value: "includes_all", label: "includes all of" },
    { value: "excludes", label: "excludes" },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  boolean: [
    { value: "is_true", label: "is true", noValue: true },
    { value: "is_false", label: "is false", noValue: true },
  ],
  date: [
    { value: "is", label: "is" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "between", label: "between", dual: true },
    { value: "last_n_days", label: "in last N days" },
    { value: "is_empty", label: "is empty", noValue: true },
    { value: "is_not_empty", label: "is not empty", noValue: true },
  ],
  user: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "is_unassigned", label: "is unassigned", noValue: true },
    { value: "is_any_of", label: "is any of" },
  ],
};

// ─── Field Definition ───────────────────────────────────────────
export interface FilterFieldDef {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  icon?: LucideIcon;
  /** Static options for select / multi_select */
  options?: { label: string; value: string }[];
  /**
   * If true, options will be derived dynamically from the data set.
   * The FilterBar will compute unique values automatically.
   */
  dynamicOptions?: boolean;
  /** Custom accessor – if the DB column name differs or needs nested access */
  accessor?: (item: any) => any;
}

// ─── Filter Rule ────────────────────────────────────────────────
export interface FilterRule {
  id: string;
  field: string;
  operator: Operator;
  value: any; // string | number | string[] | { min: number; max: number } | Date | null
}

export interface FilterState {
  conjunction: "and" | "or";
  rules: FilterRule[];
  search: string;
}

export const EMPTY_FILTER_STATE: FilterState = {
  conjunction: "and",
  rules: [],
  search: "",
};

// ─── Page-Specific Field Registries ─────────────────────────────

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

/** Buyer Universe / Tracker detail */
export const BUYER_UNIVERSE_FIELDS: FilterFieldDef[] = [
  {
    key: "company_name",
    label: "Company Name",
    type: "text",
    group: "Core",
    icon: Building2,
  },
  {
    key: "pe_firm_name",
    label: "PE Firm Name",
    type: "text",
    group: "Core",
    icon: Building2,
  },
  {
    key: "hq_state",
    label: "HQ State",
    type: "select",
    group: "Location",
    icon: MapPin,
    dynamicOptions: true,
  },
  {
    key: "geographic_footprint",
    label: "Geographic Footprint",
    type: "multi_select",
    group: "Location",
    icon: Globe,
    dynamicOptions: true,
  },
  {
    key: "industry_vertical",
    label: "Industry Vertical",
    type: "text",
    group: "Business",
    icon: Briefcase,
  },
  {
    key: "services_offered",
    label: "Services Offered",
    type: "text",
    group: "Business",
    icon: Briefcase,
  },
  {
    key: "revenue_target",
    label: "Revenue Target",
    type: "currency",
    group: "Financial",
    icon: DollarSign,
  },
  {
    key: "ebitda_target",
    label: "EBITDA Target",
    type: "currency",
    group: "Financial",
    icon: DollarSign,
  },
  {
    key: "enrichment_status",
    label: "Enrichment Status",
    type: "select",
    group: "Enrichment",
    icon: Activity,
    dynamicOptions: true,
  },
  {
    key: "fit_score",
    label: "Fit Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "enriched_at",
    label: "Enriched Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
];

/** CapTarget Deals */
export const CAPTARGET_FIELDS: FilterFieldDef[] = [
  {
    key: "internal_company_name",
    label: "Company Name",
    type: "text",
    group: "Core",
    icon: Building2,
    accessor: (item: any) => item.internal_company_name || item.title || "",
  },
  {
    key: "captarget_client_name",
    label: "Client Name",
    type: "text",
    group: "Core",
    icon: Building2,
  },
  {
    key: "main_contact_name",
    label: "Contact Name",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  {
    key: "main_contact_email",
    label: "Contact Email",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  {
    key: "captarget_sheet_tab",
    label: "Source Tab",
    type: "select",
    group: "Source",
    icon: Tag,
    dynamicOptions: true,
  },
  {
    key: "captarget_interest_type",
    label: "Interest Type",
    type: "select",
    group: "Source",
    icon: Tag,
    options: [
      { label: "Interest", value: "interest" },
      { label: "No Interest", value: "no_interest" },
      { label: "Keep in Mind", value: "keep_in_mind" },
    ],
  },
  {
    key: "captarget_outreach_channel",
    label: "Outreach Channel",
    type: "select",
    group: "Source",
    icon: Tag,
    dynamicOptions: true,
  },
  {
    key: "pushed_to_all_deals",
    label: "Pushed to All Deals",
    type: "boolean",
    group: "Status",
    icon: Activity,
  },
  {
    key: "is_priority_target",
    label: "Priority Target",
    type: "boolean",
    group: "Status",
    icon: Star,
  },
  {
    key: "deal_quality_score",
    label: "Quality Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "category",
    label: "Industry",
    type: "select",
    group: "Business",
    icon: Briefcase,
    dynamicOptions: true,
    accessor: (item: any) => item.industry || item.category || "",
  },
  {
    key: "linkedin_employee_count",
    label: "Employee Count",
    type: "number",
    group: "Business",
    icon: Users,
  },
  {
    key: "linkedin_employee_range",
    label: "Employee Range",
    type: "select",
    group: "Business",
    icon: Users,
    dynamicOptions: true,
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
  {
    key: "captarget_contact_date",
    label: "Contact Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
  {
    key: "created_at",
    label: "Created Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
  {
    key: "website",
    label: "Website",
    type: "text",
    group: "Core",
    icon: Globe,
    accessor: (item: any) => {
      const raw = item.website;
      if (!raw || !raw.trim() || raw.includes("@")) return null;
      const v = raw.trim().replace(/^[a-z]{3,6}:\/\//i, "").replace(/^www\./i, "").split("/")[0].split("?")[0].split("#")[0];
      return (v && v.includes(".") && !v.includes(" ") && !/^(test|no|example)\./i.test(v)) ? v : null;
    },
  },
  {
    key: "deal_owner_id",
    label: "Deal Owner",
    type: "user",
    group: "Admin",
    icon: Users,
  },
];

/** GP Partner Deals */
export const GP_PARTNER_FIELDS: FilterFieldDef[] = [
  {
    key: "internal_company_name",
    label: "Company Name",
    type: "text",
    group: "Core",
    icon: Building2,
    accessor: (item: any) => item.internal_company_name || item.title || "",
  },
  {
    key: "main_contact_name",
    label: "Contact Name",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  {
    key: "main_contact_email",
    label: "Contact Email",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  {
    key: "website",
    label: "Website",
    type: "text",
    group: "Core",
    icon: Globe,
    accessor: (item: any) => {
      const raw = item.website;
      if (!raw || !raw.trim() || raw.includes("@")) return null;
      const v = raw.trim().replace(/^[a-z]{3,6}:\/\//i, "").replace(/^www\./i, "").split("/")[0].split("?")[0].split("#")[0];
      return (v && v.includes(".") && !v.includes(" ") && !/^(test|no|example)\./i.test(v)) ? v : null;
    },
  },
  {
    key: "industry",
    label: "Industry",
    type: "select",
    group: "Business",
    icon: Briefcase,
    dynamicOptions: true,
  },
  {
    key: "category",
    label: "Category",
    type: "select",
    group: "Business",
    icon: Briefcase,
    dynamicOptions: true,
  },
  {
    key: "pushed_to_all_deals",
    label: "Pushed to All Deals",
    type: "boolean",
    group: "Status",
    icon: Activity,
  },
  {
    key: "is_priority_target",
    label: "Priority Target",
    type: "boolean",
    group: "Status",
    icon: Star,
  },
  {
    key: "deal_quality_score",
    label: "Quality Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "linkedin_employee_count",
    label: "Employee Count",
    type: "number",
    group: "Business",
    icon: Users,
  },
  {
    key: "linkedin_employee_range",
    label: "Employee Range",
    type: "select",
    group: "Business",
    icon: Users,
    dynamicOptions: true,
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
  {
    key: "created_at",
    label: "Created Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
  {
    key: "deal_owner_id",
    label: "Deal Owner",
    type: "user",
    group: "Admin",
    icon: Users,
  },
];

/** Valuation Calculator Leads */
export const VALUATION_LEAD_FIELDS: FilterFieldDef[] = [
  // ── Core ─────────────────────────────────────────────────────────
  {
    key: "display_name",
    label: "Lead Name",
    type: "text",
    group: "Core",
    icon: Building2,
    accessor: (item: any) => item.business_name || item.display_name || item.full_name || "",
  },
  {
    key: "website",
    label: "Website",
    type: "text",
    group: "Core",
    // Mirrors inferWebsite logic: validates the website is a real domain (no spaces, contains dot)
    accessor: (item: any) => {
      // Helper: check if a string is a valid-looking domain
      const isValidDomain = (s: string): boolean => {
        const v = s.trim().toLowerCase()
          .replace(/^[a-z]{3,6}:\/\//i, "") // strip protocol
          .replace(/^www\./i, "")           // strip www
          .split("/")[0].split("?")[0].split("#")[0]; // strip path
        return !!(v && v.includes(".") && !v.includes(" ") && !/^(test|no|example)\./i.test(v));
      };
      const raw = item.website;
      if (raw && raw.trim() && !raw.includes("@") && isValidDomain(raw)) return raw.trim();
      // No valid website — return null (filter treats as empty)
      return null;
    },
    icon: Globe,
  },
  {
    key: "calculator_type",
    label: "Calculator Type",
    type: "select",
    group: "Core",
    icon: Tag,
    options: [
      { label: "General", value: "general" },
      { label: "Auto Shop", value: "auto_shop" },
      { label: "HVAC", value: "hvac" },
      { label: "Collision", value: "collision" },
    ],
  },
  // ── Contact ───────────────────────────────────────────────────────
  {
    key: "full_name",
    label: "Contact Name",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  {
    key: "email",
    label: "Email",
    type: "text",
    group: "Contact",
    icon: Users,
  },
  // ── Business ──────────────────────────────────────────────────────
  {
    key: "industry",
    label: "Industry",
    type: "select",
    group: "Business",
    icon: Briefcase,
    dynamicOptions: true,
  },
  {
    key: "growth_trend",
    label: "Growth Trend",
    type: "select",
    group: "Business",
    icon: TrendingUp,
    options: [
      { label: "100%+ Growth", value: "100-plus" },
      { label: "50-100% Growth", value: "50-100" },
      { label: "25-50% Growth", value: "25-50" },
      { label: "10-25% Growth", value: "10-25" },
      { label: "0-10% Growth", value: "0-10" },
      { label: "Negative", value: "negative" },
    ],
  },
  {
    key: "owner_dependency",
    label: "Owner Dependency",
    type: "number",
    group: "Business",
    icon: Users,
  },
  {
    key: "buyer_lane",
    label: "Buyer Lane",
    type: "select",
    group: "Business",
    icon: Tag,
    dynamicOptions: true,
  },
  // ── Seller Intent ─────────────────────────────────────────────────
  {
    key: "open_to_intros",
    label: "Open to Intros",
    type: "boolean",
    group: "Seller Intent",
    icon: Activity,
  },
  {
    key: "exit_timing",
    label: "Exit Timing",
    type: "select",
    group: "Seller Intent",
    icon: Activity,
    options: [
      { label: "Exit Now", value: "now" },
      { label: "1-2 Years", value: "1-2years" },
      { label: "Exploring", value: "exploring" },
    ],
  },
  {
    key: "cta_clicked",
    label: "CTA Clicked",
    type: "boolean",
    group: "Seller Intent",
    icon: Activity,
  },
  // ── Status ────────────────────────────────────────────────────────
  {
    key: "is_priority_target",
    label: "Priority Target",
    type: "boolean",
    group: "Status",
    icon: Star,
  },
  {
    key: "pushed_to_all_deals",
    label: "Pushed to All Deals",
    type: "boolean",
    group: "Status",
    icon: Activity,
  },
  {
    key: "status",
    label: "Lead Status",
    type: "select",
    group: "Status",
    icon: Tag,
    options: [
      { label: "Active", value: "active" },
      { label: "Pushed", value: "pushed" },
      { label: "Contacted", value: "contacted" },
      { label: "Qualified", value: "qualified" },
      { label: "Excluded", value: "excluded" },
    ],
  },
  {
    key: "lead_source",
    label: "Lead Source",
    type: "select",
    group: "Status",
    icon: Tag,
    dynamicOptions: true,
  },
  // ── Scoring ───────────────────────────────────────────────────────
  {
    key: "quality_label",
    label: "Quality Tier",
    type: "select",
    group: "Scoring",
    icon: TrendingUp,
    options: [
      { label: "Very Strong", value: "Very Strong" },
      { label: "Strong", value: "Strong" },
      { label: "Solid", value: "Solid" },
      { label: "Average", value: "Average" },
      { label: "Needs Work", value: "Needs Work" },
    ],
  },
  {
    key: "lead_score",
    label: "Lead Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  {
    key: "readiness_score",
    label: "Readiness Score",
    type: "number",
    group: "Scoring",
    icon: TrendingUp,
  },
  // ── Financial ─────────────────────────────────────────────────────
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
  // ── Location ──────────────────────────────────────────────────────
  {
    key: "region",
    label: "Region",
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
  // ── Admin ─────────────────────────────────────────────────────────
  {
    key: "created_at",
    label: "Submitted Date",
    type: "date",
    group: "Admin",
    icon: Calendar,
  },
];

/** Activity Dashboard */
export const ACTIVITY_FIELDS: FilterFieldDef[] = [
  {
    key: "user_name",
    label: "User Name",
    type: "text",
    group: "User",
    icon: Users,
  },
  {
    key: "user_email",
    label: "User Email",
    type: "text",
    group: "User",
    icon: Users,
  },
  {
    key: "description",
    label: "Description",
    type: "text",
    group: "Core",
    icon: Activity,
  },
  {
    key: "activity_type",
    label: "Activity Type",
    type: "select",
    group: "Core",
    icon: Tag,
    options: [
      { label: "Signup", value: "signup" },
      { label: "Listing View", value: "listing_view" },
      { label: "Save", value: "save" },
      { label: "Connection Request", value: "connection_request" },
      { label: "Search", value: "search" },
    ],
  },
];
