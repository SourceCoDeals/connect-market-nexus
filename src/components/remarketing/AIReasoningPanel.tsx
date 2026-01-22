import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataCompleteness } from "@/types/remarketing";

interface AIReasoningPanelProps {
  reasoning: string | null;
  dataCompleteness?: DataCompleteness | null;
  thesisSummary?: string | null;
  targetGeographies?: string[];
  targetServices?: string[];
  defaultExpanded?: boolean;
  className?: string;
}

const completenessConfig: Record<DataCompleteness, { 
  label: string; 
  icon: typeof CheckCircle2; 
  color: string;
  description: string;
}> = {
  'high': { 
    label: 'High', 
    icon: CheckCircle2, 
    color: 'text-emerald-600',
    description: 'Comprehensive buyer data available'
  },
  'medium': { 
    label: 'Medium', 
    icon: Info, 
    color: 'text-amber-600',
    description: 'Some buyer data may be incomplete'
  },
  'low': { 
    label: 'Low', 
    icon: AlertCircle, 
    color: 'text-red-600',
    description: 'Limited buyer data - scoring may be less accurate'
  },
};

export const AIReasoningPanel = ({
  reasoning,
  dataCompleteness,
  thesisSummary,
  targetGeographies,
  targetServices,
  defaultExpanded = false,
  className,
}: AIReasoningPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const completeness = dataCompleteness ? completenessConfig[dataCompleteness] : null;
  const CompletenessIcon = completeness?.icon || Info;

  return (
    <div className={cn("border rounded-lg", className)}>
      <Button
        variant="ghost"
        className="w-full justify-between px-4 py-3 h-auto"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">AI Analysis</span>
          {completeness && (
            <span className={cn("flex items-center gap-1 text-xs", completeness.color)}>
              <CompletenessIcon className="h-3 w-3" />
              {completeness.label} data
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Data Completeness Warning */}
          {completeness && dataCompleteness !== 'high' && (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-lg text-sm",
              dataCompleteness === 'low' ? "bg-red-50" : "bg-amber-50"
            )}>
              <CompletenessIcon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", completeness.color)} />
              <p className={completeness.color}>{completeness.description}</p>
            </div>
          )}

          {/* AI Reasoning */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Fit Reasoning</h4>
            <p className="text-sm leading-relaxed">
              {reasoning || 'No reasoning available for this match.'}
            </p>
          </div>

          {/* Investment Thesis */}
          {thesisSummary && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Investment Thesis</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {thesisSummary}
              </p>
            </div>
          )}

          {/* Target Criteria */}
          <div className="grid grid-cols-2 gap-4">
            {targetGeographies && targetGeographies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Target Geographies</h4>
                <div className="flex flex-wrap gap-1">
                  {targetGeographies.slice(0, 5).map((geo, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
                    >
                      {geo}
                    </span>
                  ))}
                  {targetGeographies.length > 5 && (
                    <span className="text-xs text-muted-foreground">
                      +{targetGeographies.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {targetServices && targetServices.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Target Services</h4>
                <div className="flex flex-wrap gap-1">
                  {targetServices.slice(0, 5).map((service, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700"
                    >
                      {service}
                    </span>
                  ))}
                  {targetServices.length > 5 && (
                    <span className="text-xs text-muted-foreground">
                      +{targetServices.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReasoningPanel;
