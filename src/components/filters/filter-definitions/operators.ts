import type { FieldType, OperatorDef, FilterState } from "./types";

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

export const EMPTY_FILTER_STATE: FilterState = {
  conjunction: "and",
  rules: [],
  search: "",
};
