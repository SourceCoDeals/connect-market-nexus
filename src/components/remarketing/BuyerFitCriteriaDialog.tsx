import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Send, 
  Sparkles, 
  DollarSign, 
  Building2, 
  MapPin, 
  Users,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { 
  SizeCriteria, 
  GeographyCriteria, 
  ServiceCriteria, 
  TargetBuyerTypeConfig 
} from "@/types/remarketing";

interface BuyerFitCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sizeCriteria: SizeCriteria;
  geographyCriteria: GeographyCriteria;
  serviceCriteria: ServiceCriteria;
  targetBuyerTypes: TargetBuyerTypeConfig[];
  onSizeCriteriaChange: (criteria: SizeCriteria) => void;
  onGeographyCriteriaChange: (criteria: GeographyCriteria) => void;
  onServiceCriteriaChange: (criteria: ServiceCriteria) => void;
  onTargetBuyerTypesChange: (types: TargetBuyerTypeConfig[]) => void;
  universeName?: string;
}

// Helper to format criteria as readable text
const formatSizeCriteria = (criteria: SizeCriteria): string => {
  const lines: string[] = [];
  if (criteria.revenue_min) lines.push(`Min Revenue: $${(criteria.revenue_min / 1000000).toFixed(1)}M`);
  if (criteria.revenue_max) lines.push(`Max Revenue: $${(criteria.revenue_max / 1000000).toFixed(1)}M`);
  if (criteria.ebitda_min) lines.push(`Min EBITDA: $${(criteria.ebitda_min / 1000000).toFixed(2)}M`);
  if (criteria.ebitda_max) lines.push(`Max EBITDA: $${(criteria.ebitda_max / 1000000).toFixed(2)}M`);
  if (criteria.locations_min) lines.push(`Min Locations: ${criteria.locations_min}`);
  if (criteria.locations_max) lines.push(`Max Locations: ${criteria.locations_max}`);
  if (criteria.employee_min) lines.push(`Min Employees: ${criteria.employee_min}`);
  if (criteria.employee_max) lines.push(`Max Employees: ${criteria.employee_max}`);
  if (criteria.total_sqft_min) lines.push(`Min Sq Ft: ${criteria.total_sqft_min.toLocaleString()}`);
  if (criteria.total_sqft_max) lines.push(`Max Sq Ft: ${criteria.total_sqft_max.toLocaleString()}`);
  if (criteria.other_notes) lines.push(`Notes: ${criteria.other_notes}`);
  return lines.join('\n') || 'No size criteria defined';
};

const formatServiceCriteria = (criteria: ServiceCriteria): string => {
  const lines: string[] = [];
  if (criteria.required_services?.length) lines.push(`Required: ${criteria.required_services.join(', ')}`);
  if (criteria.preferred_services?.length) lines.push(`Preferred: ${criteria.preferred_services.join(', ')}`);
  if (criteria.excluded_services?.length) lines.push(`Excluded: ${criteria.excluded_services.join(', ')}`);
  if (criteria.business_model) lines.push(`Business Model: ${criteria.business_model}`);
  if (criteria.customer_profile) lines.push(`Customer Profile: ${criteria.customer_profile}`);
  return lines.join('\n') || 'No service criteria defined';
};

const formatGeographyCriteria = (criteria: GeographyCriteria): string => {
  const lines: string[] = [];
  if (criteria.target_regions?.length) lines.push(`Regions: ${criteria.target_regions.join(', ')}`);
  if (criteria.target_states?.length) lines.push(`States: ${criteria.target_states.join(', ')}`);
  if (criteria.exclude_states?.length) lines.push(`Excluded States: ${criteria.exclude_states.join(', ')}`);
  if (criteria.coverage) lines.push(`Coverage: ${criteria.coverage}`);
  if (criteria.hq_requirements) lines.push(`HQ Requirements: ${criteria.hq_requirements}`);
  if (criteria.other_notes) lines.push(`Notes: ${criteria.other_notes}`);
  return lines.join('\n') || 'No geography criteria defined';
};

const formatBuyerTypes = (types: TargetBuyerTypeConfig[]): string => {
  return types
    .filter(t => t.enabled)
    .sort((a, b) => a.rank - b.rank)
    .map(t => {
      const lines = [`Priority ${t.rank}: ${t.name}`];
      if (t.description) lines.push(`  Description: ${t.description}`);
      if (t.locations_min || t.locations_max) {
        lines.push(`  Locations: ${t.locations_min || 0} - ${t.locations_max || '∞'}`);
      }
      if (t.revenue_per_location) {
        lines.push(`  Rev/Location: $${(t.revenue_per_location / 1000000).toFixed(1)}M`);
      }
      if (t.deal_requirements) lines.push(`  Requirements: ${t.deal_requirements}`);
      return lines.join('\n');
    })
    .join('\n\n') || 'No buyer types enabled';
};

// Parse text back to criteria objects
const parseSizeCriteria = (text: string): Partial<SizeCriteria> => {
  const result: Partial<SizeCriteria> = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const revenueMinMatch = line.match(/min revenue[:\s]*\$?([\d.]+)\s*m/i);
    const revenueMaxMatch = line.match(/max revenue[:\s]*\$?([\d.]+)\s*m/i);
    const ebitdaMinMatch = line.match(/min ebitda[:\s]*\$?([\d.]+)\s*m/i);
    const ebitdaMaxMatch = line.match(/max ebitda[:\s]*\$?([\d.]+)\s*m/i);
    const locMinMatch = line.match(/min locations?[:\s]*(\d+)/i);
    const locMaxMatch = line.match(/max locations?[:\s]*(\d+)/i);
    const notesMatch = line.match(/notes[:\s]*(.*)/i);
    
    if (revenueMinMatch) result.revenue_min = parseFloat(revenueMinMatch[1]) * 1000000;
    if (revenueMaxMatch) result.revenue_max = parseFloat(revenueMaxMatch[1]) * 1000000;
    if (ebitdaMinMatch) result.ebitda_min = parseFloat(ebitdaMinMatch[1]) * 1000000;
    if (ebitdaMaxMatch) result.ebitda_max = parseFloat(ebitdaMaxMatch[1]) * 1000000;
    if (locMinMatch) result.locations_min = parseInt(locMinMatch[1]);
    if (locMaxMatch) result.locations_max = parseInt(locMaxMatch[1]);
    if (notesMatch) result.other_notes = notesMatch[1].trim();
  }
  
  return result;
};

const parseServiceCriteria = (text: string): Partial<ServiceCriteria> => {
  const result: Partial<ServiceCriteria> = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const requiredMatch = line.match(/required[:\s]*(.*)/i);
    const preferredMatch = line.match(/preferred[:\s]*(.*)/i);
    const excludedMatch = line.match(/excluded[:\s]*(.*)/i);
    const modelMatch = line.match(/business model[:\s]*(.*)/i);
    const customerMatch = line.match(/customer profile[:\s]*(.*)/i);
    
    if (requiredMatch) result.required_services = requiredMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (preferredMatch) result.preferred_services = preferredMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (excludedMatch) result.excluded_services = excludedMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (modelMatch) result.business_model = modelMatch[1].trim();
    if (customerMatch) result.customer_profile = customerMatch[1].trim();
  }
  
  return result;
};

const parseGeographyCriteria = (text: string): Partial<GeographyCriteria> => {
  const result: Partial<GeographyCriteria> = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const regionsMatch = line.match(/regions?[:\s]*(.*)/i);
    const statesMatch = line.match(/states[:\s]*(.*)/i);
    const excludedMatch = line.match(/excluded states?[:\s]*(.*)/i);
    const coverageMatch = line.match(/coverage[:\s]*(local|regional|national)/i);
    const hqMatch = line.match(/hq requirements?[:\s]*(.*)/i);
    const notesMatch = line.match(/notes[:\s]*(.*)/i);
    
    if (regionsMatch && !line.toLowerCase().includes('excluded')) {
      result.target_regions = regionsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    if (statesMatch && !line.toLowerCase().includes('excluded')) {
      result.target_states = statesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    if (excludedMatch) result.exclude_states = excludedMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    if (coverageMatch) result.coverage = coverageMatch[1].toLowerCase() as GeographyCriteria['coverage'];
    if (hqMatch) result.hq_requirements = hqMatch[1].trim();
    if (notesMatch) result.other_notes = notesMatch[1].trim();
  }
  
  return result;
};

export const BuyerFitCriteriaDialog = ({
  open,
  onOpenChange,
  sizeCriteria,
  geographyCriteria,
  serviceCriteria,
  targetBuyerTypes,
  onSizeCriteriaChange,
  onGeographyCriteriaChange,
  onServiceCriteriaChange,
  onTargetBuyerTypesChange,
  universeName,
}: BuyerFitCriteriaDialogProps) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Local text state for each criteria area
  const [sizeText, setSizeText] = useState(() => formatSizeCriteria(sizeCriteria));
  const [serviceText, setServiceText] = useState(() => formatServiceCriteria(serviceCriteria));
  const [geoText, setGeoText] = useState(() => formatGeographyCriteria(geographyCriteria));
  const [buyerTypesText, setBuyerTypesText] = useState(() => formatBuyerTypes(targetBuyerTypes));

  // Reset text when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSizeText(formatSizeCriteria(sizeCriteria));
      setServiceText(formatServiceCriteria(serviceCriteria));
      setGeoText(formatGeographyCriteria(geographyCriteria));
      setBuyerTypesText(formatBuyerTypes(targetBuyerTypes));
    }
    onOpenChange(newOpen);
  };

  const handleAIEdit = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsProcessing(true);
    try {
      // Combine all current criteria into text for AI processing
      const currentCriteria = `
Size Criteria:
${sizeText}

Service/Product Mix:
${serviceText}

Geography:
${geoText}

Buyer Types:
${buyerTypesText}
      `.trim();

      const { data, error } = await supabase.functions.invoke('parse-fit-criteria', {
        body: {
          fit_criteria_text: `Current criteria:\n${currentCriteria}\n\nUser instruction: ${aiPrompt}`,
          universe_name: universeName || 'Unknown',
        },
      });

      if (error) throw error;

      // Update each criteria section with AI results
      if (data) {
        if (data.size) {
          const newSize = { ...sizeCriteria, ...data.size };
          setSizeText(formatSizeCriteria(newSize));
        }
        if (data.services) {
          const newService = { ...serviceCriteria, ...data.services };
          setServiceText(formatServiceCriteria(newService));
        }
        if (data.geography) {
          const newGeo = { ...geographyCriteria, ...data.geography };
          setGeoText(formatGeographyCriteria(newGeo));
        }
        
        toast.success(`AI updated criteria with ${Math.round((data.confidence || 0.5) * 100)}% confidence`);
      }
      
      setAiPrompt("");
    } catch (error) {
      console.error('AI edit failed:', error);
      toast.error('AI processing failed. Please edit manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    // Parse text back to structured criteria
    const parsedSize = parseSizeCriteria(sizeText);
    const parsedService = parseServiceCriteria(serviceText);
    const parsedGeo = parseGeographyCriteria(geoText);
    
    onSizeCriteriaChange({ ...sizeCriteria, ...parsedSize });
    onServiceCriteriaChange({ ...serviceCriteria, ...parsedService });
    onGeographyCriteriaChange({ ...geographyCriteria, ...parsedGeo });
    // Note: buyer types editing would need more sophisticated parsing for full support
    
    toast.success('Buyer fit criteria updated');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Buyer Fit Criteria</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define the criteria that will guide buyer matching for this universe.
          </p>
        </DialogHeader>

        {/* AI Quick Edit */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Quick Edit with AI
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Lower minimum locations to 3, add Texas to target states"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleAIEdit()}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button 
              size="icon" 
              onClick={handleAIEdit} 
              disabled={isProcessing || !aiPrompt.trim()}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* 2x2 Grid of Criteria Textareas */}
        <div className="grid grid-cols-2 gap-4">
          {/* Size Criteria */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-green-500" />
              Size Criteria
            </Label>
            <Textarea
              value={sizeText}
              onChange={(e) => setSizeText(e.target.value)}
              className="min-h-[180px] font-mono text-sm"
              placeholder="Min Revenue: $2M&#10;Max Revenue: $10M&#10;Min EBITDA: $500K&#10;Min Locations: 3"
            />
          </div>

          {/* Service/Product Mix */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-orange-500" />
              Service/Product Mix
            </Label>
            <Textarea
              value={serviceText}
              onChange={(e) => setServiceText(e.target.value)}
              className="min-h-[180px] font-mono text-sm"
              placeholder="Required: Collision repair, paint&#10;Excluded: Heavy duty, fleet&#10;Business Model: DRP-focused"
            />
          </div>

          {/* Geography */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-blue-500" />
              Geography
            </Label>
            <Textarea
              value={geoText}
              onChange={(e) => setGeoText(e.target.value)}
              className="min-h-[180px] font-mono text-sm"
              placeholder="Regions: Southeast, Southwest&#10;States: TX, FL, GA, AZ&#10;Coverage: Regional&#10;HQ Requirements: None"
            />
          </div>

          {/* Buyer Types */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-purple-500" />
              Buyer Types
            </Label>
            <Textarea
              value={buyerTypesText}
              onChange={(e) => setBuyerTypesText(e.target.value)}
              className="min-h-[180px] font-mono text-sm"
              placeholder="Priority 1: Large MSOs&#10;  Description: 50+ locations&#10;  Locations: 50 - 500&#10;Priority 2: Regional MSOs&#10;  Locations: 10 - 50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyerFitCriteriaDialog;
