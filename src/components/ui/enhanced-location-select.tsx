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

  // Group locations for better organization
  const usRegions = [
    'United States',
    'Northeast US', 
    'Southeast US',
    'Southwest US', 
    'West Coast US',
    'Northwest US',
    'Pacific Northwest US',
    'Midwest US',
    'Mountain West US',
    'Great Lakes Region'
  ];

  const usStates = [
    'California',
    'Texas', 
    'New York',
    'Florida'
  ];

  const canadaRegions = [
    'Eastern Canada',
    'Western Canada',
    'Ontario',
    'Quebec', 
    'British Columbia'
  ];

  const broadRegions = [
    'United Kingdom',
    'Western Europe',
    'Eastern Europe', 
    'Asia Pacific',
    'Australia/New Zealand',
    'International'
  ];

  const options = STANDARDIZED_LOCATIONS.map(location => ({
    value: location,
    label: location
  }));

  const quickSelectOptions = [
    {
      label: 'North America',
      locations: ['United States', 'Eastern Canada', 'Western Canada']
    },
    {
      label: 'US Regions',
      locations: usRegions.slice(1) // Exclude 'United States' as it's already broad
    },
    {
      label: 'Major US States',
      locations: usStates
    },
    {
      label: 'Major Markets',
      locations: ['Northeast US', 'West Coast US', 'California', 'Texas', 'Southeast US']
    },
    {
      label: 'International',
      locations: ['United Kingdom', 'Western Europe', 'Asia Pacific']
    }
  ];

  const handleQuickSelect = (locations: string[]) => {
    // If selecting "United States", remove all US regions to avoid redundancy
    let newSelection = [...value];
    
    if (locations.includes('United States')) {
      newSelection = newSelection.filter(loc => !usRegions.includes(loc));
      newSelection = [...new Set([...newSelection, ...locations])];
    } else {
      newSelection = [...new Set([...newSelection, ...locations])];
    }
    
    onValueChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {/* Geographic Scope Explanation */}
      <div className="bg-muted/50 p-3 rounded-lg">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Geographic Strategy Tips:</div>
            <ul className="space-y-1">
              <li>• Select broader regions (like "United States") for maximum deal flow</li>
              <li>• Choose specific regions if you have location constraints or preferences</li>
              <li>• Multiple selections help if you're open to various markets</li>
            </ul>
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
        selected={[]} // Hide selected items from the dropdown
        onSelectedChange={onValueChange}
        placeholder={value.length > 0 ? `${value.length} locations selected` : placeholder}
        className={className}
      />

      {/* Location Descriptions Toggle */}
      <Collapsible open={showDescriptions} onOpenChange={setShowDescriptions}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Region Definitions & Coverage
            </span>
            {showDescriptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid gap-3 text-xs">
            <div>
              <div className="font-medium text-muted-foreground mb-2">US Regions:</div>
              {usRegions.map((location) => (
                <div key={location} className="space-y-1 mb-2">
                  <div className="font-medium">{location}</div>
                  <div className="text-muted-foreground pl-2">
                    {LOCATION_DESCRIPTIONS[location as keyof typeof LOCATION_DESCRIPTIONS]}
                  </div>
                </div>
              ))}
            </div>
            
            <div>
              <div className="font-medium text-muted-foreground mb-2">Other Regions:</div>
              {[...canadaRegions, ...broadRegions.filter(l => !['United States'].includes(l))].map((location) => (
                <div key={location} className="space-y-1 mb-2">
                  <div className="font-medium">{location}</div>
                  <div className="text-muted-foreground pl-2">
                    {LOCATION_DESCRIPTIONS[location as keyof typeof LOCATION_DESCRIPTIONS] || 'Geographic region coverage'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Selected Locations Display */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Selected ({value.length}):</div>
          <div className="flex flex-wrap gap-1">
            {value.map((location) => (
              <Badge key={location} variant="secondary" className="text-xs">
                {location}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}