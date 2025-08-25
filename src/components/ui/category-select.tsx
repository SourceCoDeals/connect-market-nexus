import React from 'react';
import { STANDARDIZED_CATEGORIES, StandardizedCategory } from '@/lib/financial-parser';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { toStandardCategory } from '@/lib/standardization';

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface MultiCategorySelectProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CategorySelect({ 
  value, 
  onValueChange, 
  placeholder = "Select category...",
  className 
}: CategorySelectProps) {
  const handleValueChange = (selectedValue: string) => {
    onValueChange(toStandardCategory(selectedValue));
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-50 max-h-[300px]">
        {STANDARDIZED_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiCategorySelect({ 
  value = [], 
  onValueChange, 
  placeholder = "Select categories...",
  className 
}: MultiCategorySelectProps) {
  const options = STANDARDIZED_CATEGORIES.map(category => ({
    value: category,
    label: category
  }));

  const handleValueChange = (selectedValues: string[]) => {
    const standardizedValues = selectedValues.map(toStandardCategory);
    onValueChange(standardizedValues);
  };

  return (
    <MultiSelect
      options={options}
      selected={value}
      onSelectedChange={handleValueChange}
      placeholder={placeholder}
      className={className}
    />
  );
}