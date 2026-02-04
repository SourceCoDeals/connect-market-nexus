import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Clock, Pencil, Sparkles, Loader2 } from "lucide-react";
import { TargetBuyerTypesPanel } from "./TargetBuyerTypesPanel";
import { AdditionalCriteriaDisplay } from "./AdditionalCriteriaDisplay";
import { CriteriaExtractionProgress } from "./CriteriaExtractionProgress";
import { CriteriaExtractionSummaryDialog, ExtractionResult } from "./CriteriaExtractionSummaryDialog";
import { 
  SizeCriteria, 
  GeographyCriteria, 
  ServiceCriteria,
  TargetBuyerTypeConfig,
  DocumentReference 
} from "@/types/remarketing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BuyerFitCriteriaAccordionProps {
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  targetBuyerTypes: TargetBuyerTypeConfig[];
  onTargetBuyerTypesChange: (types: TargetBuyerTypeConfig[]) => void;
  onEditCriteria?: () => void;
  defaultOpen?: boolean;
  className?: string;
  // New props for criteria extraction
  universeId?: string;
  universeName?: string;
  maGuideContent?: string;
  maGuideDocument?: DocumentReference;
  onCriteriaExtracted?: () => void;
}

export const BuyerFitCriteriaAccordion = ({
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  targetBuyerTypes,
  onTargetBuyerTypesChange,
  onEditCriteria,
  defaultOpen = false,
  className = "",
  universeId,
  universeName,
  maGuideContent,
  maGuideDocument,
  onCriteriaExtracted
}: BuyerFitCriteriaAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  const enabledTypesCount = targetBuyerTypes.filter(t => t.enabled).length;

  // Check if guide exists - either as content or as a document
  const hasGuide = (maGuideContent && maGuideContent.length > 1000) || !!maGuideDocument;

  // Extract buyer fit criteria from the M&A guide
  const handleExtractCriteria = async () => {
    if (!universeId) {
      toast.error("Universe ID is required for criteria extraction");
      return;
    }

    setIsExtracting(true);

    try {
      // If we have content directly, use it; otherwise fetch from document URL
      let guideContent = maGuideContent;
      
      if ((!guideContent || guideContent.length < 1000) && maGuideDocument?.url) {
        toast.info("Fetching guide content...");
        const response = await fetch(maGuideDocument.url);
        if (!response.ok) {
          throw new Error("Failed to fetch guide document");
        }
        guideContent = await response.text();
      }
      
      if (!guideContent || guideContent.length < 1000) {
        toast.error("M&A Guide must have at least 1,000 characters to extract criteria");
        setIsExtracting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('extract-buyer-criteria', {
        body: {
          universe_id: universeId,
          guide_content: guideContent,
          source_name: `${universeName || 'Universe'} M&A Guide`,
          industry_name: universeName || 'Unknown Industry'
        }
      });

      if (error) {
        // Handle rate limits and payment required
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          toast.error("AI credits depleted. Please add credits in Settings → Workspace → Usage.", {
            duration: 10000
          });
          return;
        }
        if (error.message?.includes('429') || error.message?.includes('Rate')) {
          toast.warning("Rate limit reached. Please wait a moment and try again.");
          return;
        }
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Extraction failed');
      }

      const confidence = data.confidence || 0;
      
      // Build extraction result for summary dialog
      const result: ExtractionResult = {
        success: true,
        confidence,
        extractedCriteria: data.extracted_data || {},
        warnings: data.warnings || []
      };
      
      setExtractionResult(result);
      setShowSummaryDialog(true);
      
      // Notify parent to refresh data
      onCriteriaExtracted?.();

    } catch (error) {
      console.error('Criteria extraction error:', error);
      const errorMessage = (error as Error).message;
      
      // Show error in summary dialog
      setExtractionResult({
        success: false,
        confidence: 0,
        error: errorMessage
      });
      setShowSummaryDialog(true);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <>
    {/* Progress indicator shown during extraction */}
    {isExtracting && (
      <CriteriaExtractionProgress universeName={universeName} />
    )}
    
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
                {/* Extract Criteria button - only shows when guide is saved */}
                {hasGuide && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtractCriteria();
                    }}
                    disabled={isExtracting}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Extract from Guide
                      </>
                    )}
                  </Button>
                )}
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
    
    {/* Summary Dialog */}
    <CriteriaExtractionSummaryDialog
      open={showSummaryDialog}
      onOpenChange={setShowSummaryDialog}
      result={extractionResult}
      universeName={universeName}
    />
    </>
  );
};

export default BuyerFitCriteriaAccordion;
