import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormattedInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string | number;
  onChange?: (value: string) => void;
  onValueChange?: (numericValue: number) => void;
  formatType?: 'currency' | 'number';
}

const formatNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  // Add commas as thousand separators
  return parseInt(digits).toLocaleString();
};

const parseNumber = (value: string): number => {
  // Remove all non-digit characters and convert to number
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits) : 0;
};

export const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
  ({ className, value = "", onChange, onValueChange, onBlur, formatType = 'number', ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>("");
    const [isFocused, setIsFocused] = useState(false);

    // Update display value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        const stringValue = String(value);
        if (stringValue && stringValue !== '0') {
          setDisplayValue(formatNumber(stringValue));
        } else {
          setDisplayValue(stringValue);
        }
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow raw input while typing
      setDisplayValue(inputValue);
      
      // Call onChange with the raw input value
      onChange?.(inputValue);
      
      // Call onValueChange with the parsed numeric value
      const numericValue = parseNumber(inputValue);
      onValueChange?.(numericValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Show raw number for editing
      const numericValue = parseNumber(displayValue);
      if (numericValue > 0) {
        setDisplayValue(numericValue.toString());
      }
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      // Format the value when losing focus
      const numericValue = parseNumber(displayValue);
      if (numericValue > 0) {
        const formatted = formatNumber(numericValue.toString());
        setDisplayValue(formatted);
        onChange?.(formatted);
      } else {
        setDisplayValue('');
        onChange?.('');
      }
      
      onBlur?.(e);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(className)}
        placeholder="0"
      />
    );
  }
);

FormattedInput.displayName = "FormattedInput";