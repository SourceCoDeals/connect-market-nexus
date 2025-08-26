import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxChips?: number;
  className?: string;
  disabled?: boolean;
}

export const ChipInput: React.FC<ChipInputProps> = ({
  value = [],
  onChange,
  placeholder = "Type and press Enter...",
  maxChips = 10,
  className,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeChip(value.length - 1);
    }
  };

  const addChip = () => {
    const trimmedValue = inputValue.trim();
    if (
      trimmedValue &&
      !value.includes(trimmedValue) &&
      value.length < maxChips
    ) {
      onChange([...value, trimmedValue]);
      setInputValue("");
    }
  };

  const removeChip = (index: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addChip();
    }
  };

  return (
    <div
      className={cn(
        "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-wrap gap-1">
        {value.map((chip, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="text-xs px-2 py-0.5 gap-1"
          >
            <span>{chip}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(index);
                }}
                className="ml-1 hover:bg-background/80 rounded-sm p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && value.length < maxChips && (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : ""}
            className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-20 px-0 h-6"
          />
        )}
      </div>
    </div>
  );
};