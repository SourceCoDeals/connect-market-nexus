import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FilterFieldDef, FilterRule, OperatorDef } from "./filter-definitions";
import { OPERATORS_BY_TYPE } from "./filter-definitions";

interface FilterPillProps {
  rule: FilterRule;
  fieldDef: FilterFieldDef;
  options: { label: string; value: string }[];
  onRemove: () => void;
  onClick?: () => void;
}

function formatValue(
  value: any,
  fieldDef: FilterFieldDef,
  operator: string,
  options: { label: string; value: string }[]
): string {
  if (value == null || value === "") return "";

  // Boolean / empty operators
  const opDef = OPERATORS_BY_TYPE[fieldDef.type]?.find(
    (o) => o.value === operator
  );
  if (opDef?.noValue) return "";

  // Currency
  if (fieldDef.type === "currency") {
    if (typeof value === "object" && value.min != null) {
      const fmtMin = value.min ? `$${Number(value.min).toLocaleString()}` : "?";
      const fmtMax = value.max ? `$${Number(value.max).toLocaleString()}` : "?";
      return `${fmtMin} - ${fmtMax}`;
    }
    return `$${Number(value).toLocaleString()}`;
  }

  // Number between
  if (
    (fieldDef.type === "number") &&
    typeof value === "object" &&
    value.min != null
  ) {
    return `${value.min} - ${value.max}`;
  }

  // Array (multi-select)
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.length <= 2) {
      return value
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return `${value.length} selected`;
  }

  // Select – map value to label
  if (fieldDef.type === "select" || fieldDef.type === "user") {
    return options.find((o) => o.value === value)?.label ?? String(value);
  }

  // Date – last_n_days
  if (operator === "last_n_days") {
    return `${value} days`;
  }

  // Date object
  if (fieldDef.type === "date" && typeof value === "object" && value.min) {
    const minStr = value.min instanceof Date
      ? value.min.toLocaleDateString()
      : new Date(value.min).toLocaleDateString();
    const maxStr = value.max
      ? value.max instanceof Date
        ? value.max.toLocaleDateString()
        : new Date(value.max).toLocaleDateString()
      : "?";
    return `${minStr} - ${maxStr}`;
  }

  if (value instanceof Date) return value.toLocaleDateString();

  return String(value);
}

export function FilterPill({
  rule,
  fieldDef,
  options,
  onRemove,
  onClick,
}: FilterPillProps) {
  const opDef = OPERATORS_BY_TYPE[fieldDef.type]?.find(
    (o) => o.value === rule.operator
  );
  const opLabel = opDef?.label ?? rule.operator;
  const valueStr = formatValue(rule.value, fieldDef, rule.operator, options);

  return (
    <Badge
      variant="secondary"
      className="h-7 px-2.5 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 cursor-pointer transition-colors text-xs font-normal"
      onClick={onClick}
    >
      <span className="font-medium">{fieldDef.label}</span>
      <span className="text-primary/70">{opLabel}</span>
      {valueStr && <span className="font-medium">{valueStr}</span>}
      <button
        className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
