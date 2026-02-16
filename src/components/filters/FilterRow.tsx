import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FilterFieldDef,
  type FilterRule,
  type Operator,
  type OperatorDef,
  OPERATORS_BY_TYPE,
} from "./filter-definitions";
import { TextValueInput, NumberValueInput, SelectValueInput, DateValueInput, UserValueInput } from "./value-inputs";

interface FilterRowProps {
  rule: FilterRule;
  fieldDef: FilterFieldDef;
  options: { label: string; value: string }[];
  allFields: FilterFieldDef[];
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
  onFieldChange: (newFieldKey: string) => void;
}

export function FilterRow({
  rule,
  fieldDef,
  options,
  allFields,
  onChange,
  onRemove,
  onFieldChange,
}: FilterRowProps) {
  const operatorDefs = OPERATORS_BY_TYPE[fieldDef.type] ?? [];
  const currentOp = operatorDefs.find((o) => o.value === rule.operator);

  const handleOperatorChange = (op: string) => {
    onChange({ ...rule, operator: op as Operator, value: null });
  };

  const handleValueChange = (value: any) => {
    onChange({ ...rule, value });
  };

  const isMultiOperator =
    rule.operator === "is_any_of" ||
    rule.operator === "includes_any" ||
    rule.operator === "includes_all" ||
    rule.operator === "excludes";

  return (
    <div className="flex items-center gap-2 group">
      {/* Field selector */}
      <Select value={rule.field} onValueChange={onFieldChange}>
        <SelectTrigger className="h-8 text-sm w-[150px] bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allFields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select value={rule.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-8 text-sm w-[130px] bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorDefs.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input – only if operator requires a value */}
      {!currentOp?.noValue && (
        <ValueInput
          fieldDef={fieldDef}
          operator={rule.operator}
          value={rule.value}
          onChange={handleValueChange}
          options={options}
          isDual={currentOp?.dual}
          isMulti={isMultiOperator}
        />
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Value Input Router ─────────────────────────────────────────
function ValueInput({
  fieldDef,
  operator,
  value,
  onChange,
  options,
  isDual,
  isMulti,
}: {
  fieldDef: FilterFieldDef;
  operator: Operator;
  value: any;
  onChange: (v: any) => void;
  options: { label: string; value: string }[];
  isDual?: boolean;
  isMulti?: boolean;
}) {
  switch (fieldDef.type) {
    case "text":
      return <TextValueInput value={value ?? ""} onChange={onChange} />;
    case "number":
      return <NumberValueInput value={value} onChange={onChange} dual={isDual} />;
    case "currency":
      return (
        <NumberValueInput value={value} onChange={onChange} dual={isDual} isCurrency />
      );
    case "select":
      return (
        <SelectValueInput
          value={value ?? (isMulti ? [] : "")}
          onChange={onChange}
          options={options}
          multi={isMulti}
        />
      );
    case "multi_select":
      return (
        <SelectValueInput
          value={value ?? []}
          onChange={onChange}
          options={options}
          multi
        />
      );
    case "date":
      return (
        <DateValueInput
          value={value}
          onChange={onChange}
          dual={isDual}
          isLastNDays={operator === "last_n_days"}
        />
      );
    case "user":
      return <UserValueInput value={value ?? (isMulti ? [] : "")} onChange={onChange} multi={isMulti} />;
    case "boolean":
      return null; // no value needed
    default:
      return <TextValueInput value={value ?? ""} onChange={onChange} />;
  }
}
