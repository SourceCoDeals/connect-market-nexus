import { SizeCriteria, GeographyCriteria, ServiceCriteria, BuyerTypesCriteria, TargetBuyerTypeConfig } from "@/types/remarketing";

export type GenerationState = 'idle' | 'clarifying' | 'generating' | 'quality_check' | 'gap_filling' | 'complete' | 'error';

export interface ClarifyQuestion {
  id: string;
  question: string;
  type: 'select' | 'multiSelect' | 'text';
  options?: string[];
  placeholder?: string;
}

export interface QualityResult {
  passed: boolean;
  score: number;
  wordCount: number;
  tableCount: number;
  placeholderCount: number;
  hasCriteria: boolean;
  hasBuyerTypes: boolean;
  hasPrimaryFocus: boolean;
  missingElements: string[];
}

export interface ExtractedCriteria {
  size_criteria?: SizeCriteria;
  geography_criteria?: GeographyCriteria;
  service_criteria?: ServiceCriteria;
  buyer_types_criteria?: BuyerTypesCriteria;
  target_buyer_types?: TargetBuyerTypeConfig[];
}

export interface ClarificationContext {
  segments?: string[];
  example_companies?: string;
  geography_focus?: string;
  revenue_range?: string;
  [key: string]: string | string[] | undefined;
}

export interface AIResearchSectionProps {
  onGuideGenerated: (content: string, criteria: ExtractedCriteria, targetBuyerTypes?: TargetBuyerTypeConfig[]) => void;
  universeName?: string;
  existingContent?: string;
  universeId?: string;
  onDocumentAdded?: (doc: { id: string; name: string; url: string; uploaded_at: string }) => void;
}
