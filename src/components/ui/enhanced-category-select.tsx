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
    cat => !popularCategories.includes(cat)
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
    <MultiSelect
      options={options}
      selected={value}
      onSelectedChange={onValueChange}
      placeholder={value.length > 0 ? `${value.length} industries selected` : placeholder}
      className={className}
    />
  );
}