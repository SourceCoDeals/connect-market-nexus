import React, { useState } from 'react';
import { STANDARDIZED_LOCATIONS } from '@/lib/financial-parser';
import { LOCATION_DESCRIPTIONS } from '@/lib/field-helpers';
import { MultiSelect } from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface EnhancedMultiLocationSelectProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function EnhancedMultiLocationSelect({ 
  value = [], 
  onValueChange, 
  placeholder = "Select locations...",
  className 
}: EnhancedMultiLocationSelectProps) {
  const [showDescriptions, setShowDescriptions] = useState(false);

  // Simplified geographic regions for business anonymity
  const globalRegions = [
    'North America',
    'United States', 
    'Canada',
    'Europe',
    'United Kingdom',
    'Asia Pacific',
    'Global/International'
  ];

  const regionalFocus = [
    'Northeast US',
    'Southeast US',
    'Midwest US',
    'Southwest US',
    'Western US'
  ];

  const options = STANDARDIZED_LOCATIONS.map(location => ({
    value: location,
    label: location
  }));

  const quickSelectOptions = [
    {
      label: 'North America',
      locations: ['United States', 'Canada']
    },
    {
      label: 'US Regions',
      locations: ['Northeast US', 'Southeast US', 'Midwest US', 'Western US']
    },
    {
      label: 'International',
      locations: ['Europe', 'United Kingdom', 'Asia Pacific']
    }
  ];

  const handleQuickSelect = (locations: string[]) => {
    // Smart selection logic to prevent redundancy
    let newSelection = [...value];
    
    locations.forEach(location => {
      if (location === 'United States' || location === 'Canada') {
        // Remove North America if selecting specific countries
        newSelection = newSelection.filter(v => v !== 'North America');
      } else if (location === 'North America') {
        // Remove US/Canada if selecting North America
        newSelection = newSelection.filter(v => !['United States', 'Canada'].includes(v));
      }
      
      if (!newSelection.includes(location)) {
        newSelection.push(location);
      }
    });
    
    onValueChange([...new Set(newSelection)]);
  };

  return (
    <MultiSelect
      options={options}
      selected={value}
      onSelectedChange={onValueChange}
      placeholder={value.length > 0 ? `${value.length} locations selected` : placeholder}
      className={className}
    />
  );
}