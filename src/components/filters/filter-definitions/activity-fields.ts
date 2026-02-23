import {
  Tag,
  Users,
  Activity,
} from "lucide-react";

import type { FilterFieldDef } from "./types";

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
