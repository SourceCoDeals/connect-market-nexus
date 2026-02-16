import { Input } from "@/components/ui/input";

interface TextValueInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextValueInput({
  value,
  onChange,
  placeholder = "Enter value...",
}: TextValueInputProps) {
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-sm w-[160px]"
    />
  );
}
