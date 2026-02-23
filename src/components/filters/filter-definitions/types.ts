import { type LucideIcon } from "lucide-react";

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
