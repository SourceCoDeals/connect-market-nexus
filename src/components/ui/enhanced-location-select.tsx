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
    <div className="space-y-4">
      {/* Geographic Strategy Tips */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">Geographic Strategy Tips:</div>
          <div className="text-muted-foreground">
            Choose broader regions for more deal flow, or specific areas if you have location constraints for operations or management.
          </div>
        </div>
      </div>

      {/* Quick Select Options */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Quick Select:</div>
        <div className="flex flex-wrap gap-2">
          {quickSelectOptions.map((option) => (
            <Button
              key={option.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(option.locations)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Selection */}
      <MultiSelect
        options={options}
        selected={value}
        onSelectedChange={onValueChange}
        placeholder={value.length > 0 ? `${value.length} locations selected` : placeholder}
        className={className}
      />

      {/* Region Definitions Toggle */}
      <Collapsible open={showDescriptions} onOpenChange={setShowDescriptions}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-xs">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Region Definitions & Coverage
            </span>
            {showDescriptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid gap-2 text-xs">
            <div className="font-medium text-muted-foreground">Regional Coverage:</div>
            {globalRegions.map((location) => (
              <div key={location} className="space-y-1">
                <div className="font-medium">{location}</div>
                <div className="text-muted-foreground pl-2">
                  {LOCATION_DESCRIPTIONS[location as keyof typeof LOCATION_DESCRIPTIONS] || 'Business opportunities in this region'}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Selected Locations Display */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Selected ({value.length}):</div>
          <div className="flex flex-wrap gap-1">
            {value.map((location) => (
              <Badge key={location} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                {location}
                <button
                  type="button"
                  onClick={() => onValueChange(value.filter(v => v !== location))}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${location}`}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}