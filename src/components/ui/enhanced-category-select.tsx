import React, { useState } from 'react';
import { STANDARDIZED_CATEGORIES } from '@/lib/financial-parser';
import { INDUSTRY_DESCRIPTIONS } from '@/lib/field-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  TechnologyIcon, 
  HealthcareIcon, 
  FinanceIcon,
  ManufacturingIcon,
  RetailIcon,
  RealEstateIcon,
  FoodBeverageIcon,
  ProfessionalServicesIcon,
  DefaultCategoryIcon
} from '@/components/icons/CategoryIcons';

interface EnhancedMultiCategorySelectProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

// Helper function to get category icon
const getCategoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  const iconClass = "w-3.5 h-3.5 text-slate-500";
  
  if (cat.includes('technology') || cat.includes('software')) {
    return <TechnologyIcon className={iconClass} />;
  }
  if (cat.includes('healthcare') || cat.includes('medical')) {
    return <HealthcareIcon className={iconClass} />;
  }
  if (cat.includes('finance') || cat.includes('insurance')) {
    return <FinanceIcon className={iconClass} />;
  }
  if (cat.includes('manufacturing')) {
    return <ManufacturingIcon className={iconClass} />;
  }
  if (cat.includes('retail') || cat.includes('e-commerce')) {
    return <RetailIcon className={iconClass} />;
  }
  if (cat.includes('real estate')) {
    return <RealEstateIcon className={iconClass} />;
  }
  if (cat.includes('food') || cat.includes('beverage')) {
    return <FoodBeverageIcon className={iconClass} />;
  }
  if (cat.includes('professional') || cat.includes('services')) {
    return <ProfessionalServicesIcon className={iconClass} />;
  }
  
  return <DefaultCategoryIcon className={iconClass} />;
};

export function EnhancedMultiCategorySelect({ 
  value = [], 
  onValueChange, 
  placeholder = "Select industries...",
  className 
}: EnhancedMultiCategorySelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (category: string) => {
    if (value.includes(category)) {
      onValueChange(value.filter((v) => v !== category));
    } else {
      onValueChange([...value, category]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-11", className)}
        >
          <div className="flex items-center min-w-0">
            {value.length > 0 ? (
              <span className="text-sm truncate">
                {value.length === 1 
                  ? value[0]
                  : `${value.length} selected`
                }
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[200] w-full min-w-[var(--radix-popover-trigger-width)] p-0 bg-background border shadow-md" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {STANDARDIZED_CATEGORIES.map((category) => (
                <CommandItem
                  key={category}
                  onSelect={() => handleSelect(category)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value.includes(category) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                      {getCategoryIcon(category)}
                      <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
                        {category}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}