import {
  Building2,
  DollarSign,
  MapPin,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Briefcase,
  Globe,
} from "lucide-react";

import type { FilterFieldDef } from "./types";

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
