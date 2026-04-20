import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import {
  type SmartListRule,
  type FieldDef,
  SELLER_FIELDS,
  BUYER_FIELDS,
  getDefaultOperator,
  getDefaultValue,
} from '@/lib/smart-list-rules';

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'contains',
  contains_any: 'matches any of',
  overlaps: 'overlaps with',
  gte: '>=',
  lte: '<=',
  between: 'between',
  is_true: 'is yes',
  is_false: 'is no',
  is_not_null: 'exists',
  is_null: 'is empty',
};

interface SmartListRuleBuilderProps {
  sourceEntity: 'listings' | 'remarketing_buyers';
  rules: SmartListRule[];
  matchMode: 'all' | 'any';
  onRulesChange: (rules: SmartListRule[]) => void;
  onMatchModeChange: (mode: 'all' | 'any') => void;
}

export function SmartListRuleBuilder({
  sourceEntity,
  rules,
  matchMode,
  onRulesChange,
  onMatchModeChange,
}: SmartListRuleBuilderProps) {
  const fields = sourceEntity === 'listings' ? SELLER_FIELDS : BUYER_FIELDS;

  const addRule = () => {
    const field = fields[0];
    onRulesChange([
      ...rules,
      {
        field: field.key,
        operator: getDefaultOperator(field),
        value: getDefaultValue(field),
      },
    ]);
  };

  const updateRule = (index: number, updates: Partial<SmartListRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...updates };
    onRulesChange(next);
  };

  const removeRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
  };

  const changeField = (index: number, fieldKey: string) => {
    const fieldDef = fields.find((f) => f.key === fieldKey)!;
    updateRule(index, {
      field: fieldKey,
      operator: getDefaultOperator(fieldDef),
      value: getDefaultValue(fieldDef),
    });
  };

  return (
    <div className="space-y-4">
      {/* Match mode */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Match</Label>
        <Select value={matchMode} onValueChange={(v) => onMatchModeChange(v as 'all' | 'any')}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ALL rules</SelectItem>
            <SelectItem value="any">ANY rule</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rules */}
      <div className="space-y-2">
        {rules.map((rule, i) => {
          const fieldDef = fields.find((f) => f.key === rule.field);
          return (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {/* Field */}
                <Select value={rule.field} onValueChange={(v) => changeField(i, v)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator */}
                {fieldDef && fieldDef.operators.length > 1 && (
                  <Select
                    value={rule.operator}
                    onValueChange={(v) => {
                      const newOp = v as SmartListRule['operator'];
                      const needsArray = ['in', 'not_in', 'contains_any', 'overlaps'].includes(
                        newOp,
                      );
                      const needsTuple = newOp === 'between';
                      const noValue = ['is_true', 'is_false', 'is_not_null', 'is_null'].includes(
                        newOp,
                      );
                      const newValue: SmartListRule['value'] = noValue
                        ? true
                        : needsArray
                          ? ([] as string[])
                          : needsTuple
                            ? ([0, 100] as [number, number])
                            : typeof rule.value === 'string' || typeof rule.value === 'number'
                              ? rule.value
                              : '';
                      updateRule(i, { operator: newOp, value: newValue });
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldDef.operators.map((op) => (
                        <SelectItem key={op} value={op}>
                          {OPERATOR_LABELS[op] ?? op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fieldDef && fieldDef.operators.length === 1 && (
                  <Badge variant="outline" className="text-xs h-8 px-3 flex items-center">
                    {OPERATOR_LABELS[rule.operator] ?? rule.operator}
                  </Badge>
                )}

                {/* Value input */}
                <RuleValueInput
                  rule={rule}
                  fieldDef={fieldDef}
                  onChange={(value) => updateRule(i, { value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeRule(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Rule
      </Button>
    </div>
  );
}

// ---- Value input based on field type ----

function RuleValueInput({
  rule,
  fieldDef,
  onChange,
}: {
  rule: SmartListRule;
  fieldDef?: FieldDef;
  onChange: (value: SmartListRule['value']) => void;
}) {
  // No value needed for boolean-like operators
  if (['is_true', 'is_false', 'is_not_null', 'is_null'].includes(rule.operator)) {
    return null;
  }

  if (!fieldDef) {
    return (
      <Input
        className="w-[200px] h-8 text-xs"
        value={String(rule.value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Number input
  if (fieldDef.type === 'number') {
    if (rule.operator === 'between') {
      const [min, max] = (rule.value as [number, number]) ?? [0, 100];
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            className="w-[80px] h-8 text-xs"
            value={min}
            onChange={(e) => onChange([Number(e.target.value), max])}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="number"
            className="w-[80px] h-8 text-xs"
            value={max}
            onChange={(e) => onChange([min, Number(e.target.value)])}
          />
        </div>
      );
    }
    return (
      <Input
        type="number"
        className="w-[100px] h-8 text-xs"
        value={Number(rule.value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }

  // Date input
  if (fieldDef.type === 'date') {
    return (
      <Input
        type="date"
        className="w-[160px] h-8 text-xs"
        value={String(rule.value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Select with options
  if (fieldDef.type === 'select' && fieldDef.options && rule.operator === 'equals') {
    return (
      <Select value={String(rule.value ?? '')} onValueChange={onChange}>
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldDef.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Multi-value input (text_multi, select_multi, or 'in' operator)
  if (
    fieldDef.type === 'text_multi' ||
    fieldDef.type === 'select_multi' ||
    ['in', 'not_in', 'contains_any', 'overlaps'].includes(rule.operator)
  ) {
    return <MultiValueInput values={(rule.value as string[]) ?? []} onChange={onChange} />;
  }

  // Default text input
  return (
    <Input
      className="w-[200px] h-8 text-xs"
      value={String(rule.value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
    />
  );
}

function MultiValueInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const addValue = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput('');
    }
  };

  const removeValue = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="text-xs gap-1 h-6">
          {v}
          <button onClick={() => removeValue(v)} className="hover:text-destructive">
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Input
        className="w-[120px] h-7 text-xs"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addValue();
          }
        }}
        onBlur={addValue}
        placeholder="Add term..."
      />
    </div>
  );
}
