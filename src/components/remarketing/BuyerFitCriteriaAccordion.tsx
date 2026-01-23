import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Clock, Pencil } from "lucide-react";
import { TargetBuyerTypesPanel } from "./TargetBuyerTypesPanel";
import { AdditionalCriteriaDisplay } from "./AdditionalCriteriaDisplay";
import { 
  SizeCriteria, 
  GeographyCriteria, 
  ServiceCriteria,
  TargetBuyerTypeConfig 
} from "@/types/remarketing";

interface BuyerFitCriteriaAccordionProps {
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  targetBuyerTypes: TargetBuyerTypeConfig[];
  onTargetBuyerTypesChange: (types: TargetBuyerTypeConfig[]) => void;
  onEditCriteria?: () => void;
  defaultOpen?: boolean;
  className?: string;
}

export const BuyerFitCriteriaAccordion = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  targetBuyerTypes,
  onTargetBuyerTypesChange,
  onEditCriteria,
  defaultOpen = false,
  className = ""
}: BuyerFitCriteriaAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const enabledTypesCount = targetBuyerTypes.filter(t => t.enabled).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Buyer Fit Criteria</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {enabledTypesCount} types
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {onEditCriteria && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCriteria();
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Target Buyer Types Section */}
            <TargetBuyerTypesPanel
              buyerTypes={targetBuyerTypes}
              onBuyerTypesChange={onTargetBuyerTypesChange}
            />

            {/* Additional Criteria Section */}
            <AdditionalCriteriaDisplay
              sizeCriteria={sizeCriteria}
              geographyCriteria={geographyCriteria}
              serviceCriteria={serviceCriteria}
              onEdit={onEditCriteria}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default BuyerFitCriteriaAccordion;
