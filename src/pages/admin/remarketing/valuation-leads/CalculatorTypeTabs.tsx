import { cn } from '@/lib/utils';
import type { ValuationLead } from './types';

interface CalculatorTypeTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  calculatorTypes: string[];
  leads: ValuationLead[];
}

export function CalculatorTypeTabs({
  activeTab,
  onTabChange,
  calculatorTypes,
  leads,
}: CalculatorTypeTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border">
      <button
        onClick={() => onTabChange('all')}
        className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          activeTab === 'all'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        All Types
      </button>
      {calculatorTypes.map((type) => (
        <button
          key={type}
          onClick={() => onTabChange(type)}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === type
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {type === 'general'
            ? 'General'
            : type === 'auto_shop'
              ? 'Auto Shop'
              : type.replace(/_/g, ' ')}
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({leads.filter((l) => l.calculator_type === type).length})
          </span>
        </button>
      ))}
    </div>
  );
}
