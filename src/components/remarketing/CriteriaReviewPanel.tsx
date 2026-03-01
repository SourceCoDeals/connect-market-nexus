import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Merge,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Json } from "@/integrations/supabase/types";

interface CriteriaReviewPanelProps {
  universeId: string;
  onApplyComplete?: () => void;
}

interface SizeCriteria {
  revenue_min?: number;
  revenue_max?: number;
  ebitda_min?: number;
  ebitda_max?: number;
}

interface GeoCriteria {
  target_regions?: string[];
  target_states?: string[];
}

interface ServiceCriteria {
  target_services?: string[];
}

interface BuyerTypeEntry {
  profile_name?: string;
  buyer_type?: string;
  priority_rank?: string | number;
  [key: string]: unknown;
}

interface BuyerTypesCriteria {
  buyer_types?: BuyerTypeEntry[];
}

interface ExtractedData {
  size_criteria?: SizeCriteria;
  geography_criteria?: GeoCriteria;
  service_criteria?: ServiceCriteria;
  buyer_types_criteria?: BuyerTypesCriteria;
  [key: string]: unknown;
}

interface ExtractionSource {
  id: string;
  source_type: string;
  source_name: string;
  extraction_status: string;
  extracted_data: ExtractedData;
  confidence_scores: {
    size?: number;
    service?: number;
    geography?: number;
    buyer_types?: number;
    overall?: number;
  };
  applied_to_criteria: boolean;
  created_at: string;
}

export const CriteriaReviewPanel = ({
  universeId,
  onApplyComplete
}: CriteriaReviewPanelProps) => {
  const [sources, setSources] = useState<ExtractionSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('criteria_extraction_sources' as never)
        .select('*')
        .eq('universe_id', universeId)
        .eq('extraction_status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSources((data || []) as ExtractionSource[]);

      const unapplied = new Set(
        ((data || []) as ExtractionSource[])
          .filter(s => !s.applied_to_criteria)
          .map(s => s.id)
      );
      setSelectedSources(unapplied);
    } catch (_error: unknown) {
      toast.error('Failed to load extraction sources');
    } finally {
      setIsLoading(false);
    }
  }, [universeId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const toggleSource = (sourceId: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedSources(newSelected);
  };

  const toggleExpanded = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  const handleApplyCriteria = async () => {
    if (selectedSources.size === 0) {
      toast.error('Please select at least one source to apply');
      return;
    }

    setIsApplying(true);
    try {
      const selectedData = sources.filter(s => selectedSources.has(s.id));
      const synthesizedCriteria = synthesizeCriteria(selectedData);

      const { error: updateError } = await supabase
        .from('remarketing_buyer_universes')
        .update({
          size_criteria: synthesizedCriteria.size_criteria as unknown as Json,
          geography_criteria: synthesizedCriteria.geography_criteria as unknown as Json,
          service_criteria: synthesizedCriteria.service_criteria as unknown as Json,
          buyer_types_criteria: synthesizedCriteria.buyer_types_criteria as unknown as Json,
          updated_at: new Date().toISOString()
        })
        .eq('id', universeId);

      if (updateError) throw updateError;

      const { error: markError } = await supabase
        .from('criteria_extraction_sources' as never)
        .update({
          applied_to_criteria: true,
          applied_at: new Date().toISOString()
        } as never)
        .in('id', Array.from(selectedSources));

      if (markError) throw markError;

      await fromTable('criteria_extraction_history').insert({
        universe_id: universeId,
        change_type: 'synthesis',
        changed_sections: ['size_criteria', 'geography_criteria', 'service_criteria', 'buyer_types_criteria'],
        after_snapshot: synthesizedCriteria,
        change_summary: `Applied criteria from ${selectedSources.size} source(s): ${selectedData.map(s => s.source_name).join(', ')}`
      });

      toast.success('Criteria applied successfully', {
        description: `Merged data from ${selectedSources.size} source(s)`
      });

      loadSources();
      onApplyComplete?.();
    } catch (error: unknown) {
      toast.error('Failed to apply criteria', {
        description: (error as Error).message
      });
    } finally {
      setIsApplying(false);
    }
  };

  const synthesizeCriteria = (sources: ExtractionSource[]) => {
    const sizeCriteria = sources.map(s => s.extracted_data?.size_criteria).filter(Boolean) as SizeCriteria[];
    const geoCriteria = sources.map(s => s.extracted_data?.geography_criteria).filter(Boolean) as GeoCriteria[];
    const serviceCriteria = sources.map(s => s.extracted_data?.service_criteria).filter(Boolean) as ServiceCriteria[];
    const buyerTypesCriteria = sources.map(s => s.extracted_data?.buyer_types_criteria).filter(Boolean) as BuyerTypesCriteria[];

    return {
      size_criteria: synthesizeSizeCriteria(sizeCriteria),
      geography_criteria: synthesizeGeographyCriteria(geoCriteria),
      service_criteria: synthesizeServiceCriteria(serviceCriteria),
      buyer_types_criteria: synthesizeBuyerTypesCriteria(buyerTypesCriteria)
    };
  };

  const synthesizeSizeCriteria = (criteria: SizeCriteria[]) => {
    if (criteria.length === 0) return {};

    const revenueMin = Math.min(...criteria.map(c => c.revenue_min).filter((v): v is number => v != null));
    const revenueMax = Math.max(...criteria.map(c => c.revenue_max).filter((v): v is number => v != null));
    const ebitdaMin = Math.min(...criteria.map(c => c.ebitda_min).filter((v): v is number => v != null));
    const ebitdaMax = Math.max(...criteria.map(c => c.ebitda_max).filter((v): v is number => v != null));

    return {
      revenue_min: isFinite(revenueMin) ? revenueMin : undefined,
      revenue_max: isFinite(revenueMax) ? revenueMax : undefined,
      ebitda_min: isFinite(ebitdaMin) ? ebitdaMin : undefined,
      ebitda_max: isFinite(ebitdaMax) ? ebitdaMax : undefined
    };
  };

  const synthesizeGeographyCriteria = (criteria: GeoCriteria[]) => {
    if (criteria.length === 0) return {};

    const allRegions = new Set<string>();
    const allStates = new Set<string>();

    criteria.forEach(c => {
      c.target_regions?.forEach((r: string) => allRegions.add(r));
      c.target_states?.forEach((s: string) => allStates.add(s));
    });

    return {
      target_regions: Array.from(allRegions).sort(),
      target_states: Array.from(allStates).sort()
    };
  };

  const synthesizeServiceCriteria = (criteria: ServiceCriteria[]) => {
    if (criteria.length === 0) return {};

    const allServices = new Set<string>();
    criteria.forEach(c => {
      c.target_services?.forEach((s: string) => allServices.add(s));
    });

    return {
      target_services: Array.from(allServices).sort()
    };
  };

  const synthesizeBuyerTypesCriteria = (criteria: BuyerTypesCriteria[]) => {
    if (criteria.length === 0) return {};

    const allBuyerTypes = criteria.flatMap(c => c.buyer_types || []);
    return {
      buyer_types: allBuyerTypes
    };
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return `$${(value / 1000000).toFixed(1)}M`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review & Apply Criteria</CardTitle>
          <CardDescription>
            No extracted criteria available. Extract criteria first to review and apply.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Merge className="h-5 w-5" />
          Review & Apply Criteria
        </CardTitle>
        <CardDescription>
          Review extracted criteria from multiple sources and merge into universe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedSources.size} of {sources.length} sources selected
          </div>
          <Button
            onClick={handleApplyCriteria}
            disabled={isApplying || selectedSources.size === 0}
            size="sm"
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Merge className="mr-2 h-4 w-4" />
                Apply Selected
              </>
            )}
          </Button>
        </div>

        <Separator />

        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {sources.map((source) => {
              const ed = source.extracted_data;
              const sizeCrit = ed?.size_criteria;
              const geoCrit = ed?.geography_criteria;
              const serviceCrit = ed?.service_criteria;
              const buyerTypesCrit = ed?.buyer_types_criteria;

              return (
                <Collapsible
                  key={source.id}
                  open={expandedSources.has(source.id)}
                  onOpenChange={() => toggleExpanded(source.id)}
                >
                  <div className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedSources.has(source.id)}
                        onCheckedChange={() => toggleSource(source.id)}
                        disabled={source.applied_to_criteria}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{source.source_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(source.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {source.applied_to_criteria && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Applied
                              </Badge>
                            )}
                            {source.confidence_scores?.overall && (
                              <Badge
                                variant={source.confidence_scores.overall >= 80 ? 'default' : 'secondary'}
                              >
                                {source.confidence_scores.overall}%
                              </Badge>
                            )}
                          </div>
                        </div>

                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="mt-2">
                            {expandedSources.has(source.id) ? (
                              <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-2 h-4 w-4" />
                                Show Details
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-3">
                      <div className="pl-8 space-y-3 text-sm">
                        {/* Size Criteria */}
                        {sizeCrit && (
                          <div>
                            <div className="font-medium mb-1">Size Criteria</div>
                            <div className="text-muted-foreground space-y-1">
                              <div>Revenue: {formatCurrency(sizeCrit.revenue_min)} - {formatCurrency(sizeCrit.revenue_max)}</div>
                              <div>EBITDA: {formatCurrency(sizeCrit.ebitda_min)} - {formatCurrency(sizeCrit.ebitda_max)}</div>
                              <div className="text-xs">
                                Confidence: {source.confidence_scores?.size}%
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Geography Criteria */}
                        {geoCrit && (
                          <div>
                            <div className="font-medium mb-1">Geography Criteria</div>
                            <div className="text-muted-foreground space-y-1">
                              {(geoCrit.target_regions?.length ?? 0) > 0 && (
                                <div>Regions: {geoCrit.target_regions!.join(', ')}</div>
                              )}
                              {(geoCrit.target_states?.length ?? 0) > 0 && (
                                <div>States: {geoCrit.target_states!.join(', ')}</div>
                              )}
                              <div className="text-xs">
                                Confidence: {source.confidence_scores?.geography}%
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Service Criteria */}
                        {serviceCrit && (
                          <div>
                            <div className="font-medium mb-1">Service Criteria</div>
                            <div className="text-muted-foreground space-y-1">
                              {(serviceCrit.target_services?.length ?? 0) > 0 && (
                                <div>Target: {serviceCrit.target_services!.join(', ')}</div>
                              )}
                              <div className="text-xs">
                                Confidence: {source.confidence_scores?.service}%
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Buyer Types */}
                        {(buyerTypesCrit?.buyer_types?.length ?? 0) > 0 && (
                          <div>
                            <div className="font-medium mb-1">Buyer Types</div>
                            <div className="text-muted-foreground space-y-1">
                              {buyerTypesCrit!.buyer_types!.map((bt) => (
                                <div key={String(bt.profile_name)}>
                                  {String(bt.priority_rank)}. {String(bt.profile_name)} ({String(bt.buyer_type)})
                                </div>
                              ))}
                              <div className="text-xs">
                                Confidence: {source.confidence_scores?.buyer_types}%
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
