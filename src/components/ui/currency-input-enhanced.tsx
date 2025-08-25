import React, { useState, useEffect } from 'react';
import { Input } from './input';

interface CurrencyInputEnhancedProps {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: number) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  required?: boolean;
  className?: string;
  prefix?: string;
  suffix?: string;
}

// Format number with commas
const formatNumberWithCommas = (value: string): string => {
  // Remove all non-digit characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  
  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return parts.join('.');
};

// Parse formatted number back to numeric value
const parseFormattedNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
};

export const CurrencyInputEnhanced: React.FC<CurrencyInputEnhancedProps> = ({
  value = '',
  onChange,
  onValueChange,
  placeholder,
  name,
  id,
  required,
  className,
  prefix = '$',
  suffix = '',
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      const stringValue = typeof value === 'number' ? value.toString() : (value || '');
      if (stringValue && !isNaN(Number(stringValue.replace(/[^\d.]/g, '')))) {
        setDisplayValue(formatNumberWithCommas(stringValue));
      } else {
        setDisplayValue(stringValue);
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (isFocused) {
      // While focused, allow typing and format in real-time
      const formatted = formatNumberWithCommas(inputValue);
      setDisplayValue(formatted);
      
      // Update the actual value
      const numericValue = parseFormattedNumber(formatted);
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: formatted
          }
        };
        onChange(syntheticEvent);
      }
      
      if (onValueChange) {
        onValueChange(numericValue);
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Keep the formatted display when focusing
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    // Final formatting on blur
    if (displayValue) {
      const numericValue = parseFormattedNumber(displayValue);
      if (!isNaN(numericValue) && numericValue > 0) {
        const finalFormatted = formatNumberWithCommas(numericValue.toString());
        setDisplayValue(finalFormatted);
        
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: {
              ...e.target,
              value: finalFormatted
            }
          } as any;
          onChange(syntheticEvent);
        }
      }
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        {...props}
        id={id}
        name={name}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        className={`${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''} ${className || ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
