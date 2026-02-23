import {
  Building2,
  Tag,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Star,
  Briefcase,
  Hash,
  Globe,
} from "lucide-react";

import type { FilterFieldDef } from "./types";

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
