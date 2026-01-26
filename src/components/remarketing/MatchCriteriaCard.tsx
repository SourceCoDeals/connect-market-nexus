import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DollarSign, 
  MapPin, 
  Wrench, 
  Pencil,
  AlertTriangle,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SizeCriteria, GeographyCriteria, ServiceCriteria } from "@/types/remarketing";

interface MatchCriteriaCardProps {
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  onEdit: () => void;
  defaultOpen?: boolean;
}

const formatCurrency = (value: number | undefined) => {
  if (!value) return '-';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

export const MatchCriteriaCard = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  onEdit,
  defaultOpen = false,
}: MatchCriteriaCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Check if primary_focus is set (required for scoring)
  const hasPrimaryFocus = serviceCriteria.primary_focus && serviceCriteria.primary_focus.length > 0;
  
  // Check if we have any criteria at all
  const hasSizeCriteria = sizeCriteria.revenue_min || sizeCriteria.revenue_max || 
    sizeCriteria.ebitda_min || sizeCriteria.ebitda_max;
  const hasGeoCriteria = (geographyCriteria.target_states && geographyCriteria.target_states.length > 0) ||
    (geographyCriteria.target_regions && geographyCriteria.target_regions.length > 0);
  const hasServiceCriteria = (serviceCriteria.required_services && serviceCriteria.required_services.length > 0) ||
    (serviceCriteria.primary_focus && serviceCriteria.primary_focus.length > 0);
  
  const hasAnyCriteria = hasSizeCriteria || hasGeoCriteria || hasServiceCriteria;

  // Count total criteria items for summary
  const criteriaCount = [hasSizeCriteria, hasGeoCriteria, hasServiceCriteria].filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
                <CardTitle className="text-base font-semibold">Match Criteria</CardTitle>
                {hasPrimaryFocus ? (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ready to Score
                  </Badge>
                ) : hasAnyCriteria ? (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Missing Primary Focus
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {criteriaCount}/3 defined
                  </Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!hasAnyCriteria ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm mb-2">No criteria defined yet</p>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Set Up Criteria
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Size Summary */}
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Size</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {hasSizeCriteria ? (
                      <>
                        {(sizeCriteria.revenue_min || sizeCriteria.revenue_max) && (
                          <div className="text-muted-foreground">
                            Revenue: {formatCurrency(sizeCriteria.revenue_min)} - {formatCurrency(sizeCriteria.revenue_max)}
                          </div>
                        )}
                        {(sizeCriteria.ebitda_min || sizeCriteria.ebitda_max) && (
                          <div className="text-muted-foreground">
                            EBITDA: {formatCurrency(sizeCriteria.ebitda_min)} - {formatCurrency(sizeCriteria.ebitda_max)}
                          </div>
                        )}
                        {(sizeCriteria.locations_min || sizeCriteria.locations_max) && (
                          <div className="text-muted-foreground">
                            Locations: {sizeCriteria.locations_min || 1} - {sizeCriteria.locations_max || '∞'}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>

                {/* Geography Summary */}
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Geography</span>
                  </div>
                  <div className="space-y-1">
                    {hasGeoCriteria ? (
                      <div className="flex flex-wrap gap-1">
                        {geographyCriteria.target_regions?.slice(0, 2).map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                        ))}
                        {geographyCriteria.target_states?.slice(0, 4).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                        {((geographyCriteria.target_states?.length || 0) > 4 || 
                          (geographyCriteria.target_regions?.length || 0) > 2) && (
                          <Badge variant="outline" className="text-xs">
                            +{(geographyCriteria.target_states?.length || 0) + (geographyCriteria.target_regions?.length || 0) - 6} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>

                {/* Services Summary */}
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Services</span>
                  </div>
                  <div className="space-y-1">
                    {hasServiceCriteria ? (
                      <div className="flex flex-wrap gap-1">
                        {serviceCriteria.primary_focus?.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="default" className="text-xs">{s}</Badge>
                        ))}
                        {serviceCriteria.required_services?.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {serviceCriteria.excluded_services?.slice(0, 1).map((s, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Validation Warning */}
            {hasAnyCriteria && !hasPrimaryFocus && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-amber-700">Primary Focus required for scoring</span>
                  <p className="text-amber-600 text-xs mt-0.5">
                    Set at least one primary focus service to enable buyer matching.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default MatchCriteriaCard;
