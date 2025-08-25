import React from 'react';
import { STANDARDIZED_LOCATIONS, StandardizedLocation } from '@/lib/financial-parser';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { toStandardLocation } from '@/lib/standardization';

interface LocationSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface MultiLocationSelectProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function LocationSelect({ 
  value, 
  onValueChange, 
  placeholder = "Select location...",
  className 
}: LocationSelectProps) {
  const handleValueChange = (selectedValue: string) => {
    onValueChange(toStandardLocation(selectedValue));
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-50">
        {STANDARDIZED_LOCATIONS.map((location) => (
          <SelectItem key={location} value={location}>
            {location}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiLocationSelect({ 
  value = [], 
  onValueChange, 
  placeholder = "Select locations...",
  className 
}: MultiLocationSelectProps) {
  const options = STANDARDIZED_LOCATIONS.map(location => ({
    value: location,
    label: location
  }));

  const handleValueChange = (selectedValues: string[]) => {
    const standardizedValues = selectedValues.map(toStandardLocation);
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