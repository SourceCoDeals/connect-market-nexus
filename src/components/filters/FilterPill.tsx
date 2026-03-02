import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FilterFieldDef, FilterRule } from './filter-definitions';
import { OPERATORS_BY_TYPE } from './filter-definitions';

interface FilterPillProps {
  rule: FilterRule;
  fieldDef: FilterFieldDef;
  options: { label: string; value: string }[];
  onRemove: () => void;
  onClick?: () => void;
}

function formatValue(
  value: FilterRule['value'],
  fieldDef: FilterFieldDef,
  operator: string,
  options: { label: string; value: string }[],
): string {
  if (value == null || value === '') return '';

  // Boolean / empty operators
  const opDef = OPERATORS_BY_TYPE[fieldDef.type]?.find((o) => o.value === operator);
  if (opDef?.noValue) return '';

  // Currency
  if (fieldDef.type === 'currency') {
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      (value as { min: number; max: number }).min != null
    ) {
      const rangeVal = value as { min: number; max: number };
      const fmtMin = rangeVal.min ? `$${Number(rangeVal.min).toLocaleString()}` : '?';
      const fmtMax = rangeVal.max ? `$${Number(rangeVal.max).toLocaleString()}` : '?';
      return `${fmtMin} - ${fmtMax}`;
    }
    return `$${Number(value).toLocaleString()}`;
  }

  // Number between
  if (
    fieldDef.type === 'number' &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    (value as { min: number; max: number }).min != null
  ) {
    const rangeVal = value as { min: number; max: number };
    return `${rangeVal.min} - ${rangeVal.max}`;
  }

  // Array (multi-select)
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.length <= 2) {
      return value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ');
    }
    return `${value.length} selected`;
  }

  // Select – map value to label
  if (fieldDef.type === 'select' || fieldDef.type === 'user') {
    return options.find((o) => o.value === value)?.label ?? String(value);
  }

  // Date – last_n_days
  if (operator === 'last_n_days') {
    return `${value} days`;
  }

  // Date object
  if (
    fieldDef.type === 'date' &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    const rangeVal = value as { min: number | Date; max: number | Date };
    if (rangeVal.min) {
      const minStr =
        rangeVal.min instanceof Date
          ? rangeVal.min.toLocaleDateString()
          : new Date(rangeVal.min).toLocaleDateString();
      const maxStr = rangeVal.max
        ? rangeVal.max instanceof Date
          ? rangeVal.max.toLocaleDateString()
          : new Date(rangeVal.max).toLocaleDateString()
        : '?';
      return `${minStr} - ${maxStr}`;
    }
  }

  if (value instanceof Date) return value.toLocaleDateString();

  return String(value);
}

export function FilterPill({ rule, fieldDef, options, onRemove, onClick }: FilterPillProps) {
  const opDef = OPERATORS_BY_TYPE[fieldDef.type]?.find((o) => o.value === rule.operator);
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
