import React, { useState } from 'react';
import { STANDARDIZED_CATEGORIES } from '@/lib/financial-parser';
import { INDUSTRY_DESCRIPTIONS } from '@/lib/field-helpers';
import { MultiSelect } from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface EnhancedMultiCategorySelectProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function EnhancedMultiCategorySelect({ 
  value = [], 
  onValueChange, 
  placeholder = "Select industries...",
  className 
}: EnhancedMultiCategorySelectProps) {
  const [showDescriptions, setShowDescriptions] = useState(false);

  // Group categories for better organization
  const popularCategories = [
    'Professional Services',
    'Healthcare & Medical', 
    'Technology & Software',
    'Manufacturing',
    'Retail & E-commerce',
    'Food & Beverage',
    'Construction',
    'Transportation & Logistics'
  ];

  const allOtherCategories = STANDARDIZED_CATEGORIES.filter(
    cat => !popularCategories.includes(cat) && cat !== 'All Industries'
  );

  const options = STANDARDIZED_CATEGORIES.map(category => ({
    value: category,
    label: category
  }));

  const quickSelectOptions = [
    {
      label: 'Service Businesses',
      categories: ['Professional Services', 'Healthcare & Medical', 'Home Services', 'Consulting']
    },
    {
      label: 'Tech & Software',
      categories: ['Technology & Software', 'Telecommunications']
    },
    {
      label: 'Industrial & Manufacturing',
      categories: ['Manufacturing', 'Construction', 'Industrial Equipment']
    }
  ];

  const handleQuickSelect = (categories: string[]) => {
    const newSelection = [...new Set([...value, ...categories])];
    onValueChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {/* Quick Select Options */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Quick Select:</div>
        <div className="flex flex-wrap gap-2">
          {quickSelectOptions.map((option) => (
            <Button
              key={option.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(option.categories)}
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
        placeholder={placeholder}
        className={className}
      />

      {/* Industry Descriptions Toggle */}
      <Collapsible open={showDescriptions} onOpenChange={setShowDescriptions}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Industry Examples & Descriptions
            </span>
            {showDescriptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid gap-2 text-xs">
            <div className="font-medium text-muted-foreground">Popular Categories:</div>
            {popularCategories.map((category) => (
              <div key={category} className="space-y-1">
                <div className="font-medium">{category}</div>
                <div className="text-muted-foreground pl-2">
                  {INDUSTRY_DESCRIPTIONS[category as keyof typeof INDUSTRY_DESCRIPTIONS] || 'Various businesses in this sector'}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Selected Categories Display */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Selected ({value.length}):</div>
          <div className="flex flex-wrap gap-1">
            {value.map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}