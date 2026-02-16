import { Input } from "@/components/ui/input";

interface NumberValueInputProps {
  value: any; // number | { min: number; max: number }
  onChange: (value: any) => void;
  dual?: boolean;
  isCurrency?: boolean;
  placeholder?: string;
}

function formatDisplay(val: string, isCurrency: boolean): string {
  if (!val) return "";
  const num = Number(val.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return val;
  if (isCurrency) return num.toLocaleString();
  return val;
}

export function NumberValueInput({
  value,
  onChange,
  dual,
  isCurrency,
  placeholder,
}: NumberValueInputProps) {
  if (dual) {
    const min = value?.min ?? "";
    const max = value?.max ?? "";
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={min}
          onChange={(e) => onChange({ min: e.target.value, max })}
          placeholder={isCurrency ? "$min" : "min"}
          className="h-8 text-sm w-[90px]"
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          type="number"
          value={max}
          onChange={(e) => onChange({ min, max: e.target.value })}
          placeholder={isCurrency ? "$max" : "max"}
          className="h-8 text-sm w-[90px]"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {isCurrency && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
      )}
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (isCurrency ? "0" : "value")}
        className={`h-8 text-sm w-[130px] ${isCurrency ? "pl-6" : ""}`}
      />
    </div>
  );
}
