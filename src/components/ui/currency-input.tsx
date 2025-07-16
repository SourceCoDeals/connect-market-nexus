
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, parseCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string | number;
  onChange?: (value: string) => void;
  onValueChange?: (numericValue: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value = "", onChange, onValueChange, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>("");
    const [isFocused, setIsFocused] = useState(false);

    // Update display value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        const numericValue = typeof value === "number" ? value : parseCurrency(String(value));
        if (numericValue > 0) {
          setDisplayValue(formatNumber(numericValue));
        } else {
          setDisplayValue(String(value));
        }
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);
      
      // Call onChange with the raw input value
      onChange?.(inputValue);
      
      // Call onValueChange with the parsed numeric value
      const numericValue = parseCurrency(inputValue);
      onValueChange?.(numericValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      // Format the value when losing focus
      const numericValue = parseCurrency(displayValue);
      if (numericValue > 0) {
        const formatted = formatNumber(numericValue);
        setDisplayValue(formatted);
        onChange?.(formatted);
      }
      
      onBlur?.(e);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn("pl-7", className)}
          placeholder="0"
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
