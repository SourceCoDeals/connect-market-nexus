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

export interface SavedProgress {
  industryName: string;
  batchIndex: number;
  content: string;
  clarificationContext: ClarificationContext;
}

export interface ClarifyingStatus {
  isLoading: boolean;
  retryCount: number;
  waitingSeconds: number;
  error: string | null;
}

export interface ClarificationPanelProps {
  questions: ClarifyQuestion[];
  answers: Record<string, string | string[]>;
  onSelectOption: (questionId: string, option: string, isMulti: boolean) => void;
  onTextAnswer: (questionId: string, value: string) => void;
  onCancel: () => void;
  onSkip: () => void;
  onConfirm: () => void;
}

export interface ClarificationLoadingProps {
  clarifyingStatus: ClarifyingStatus;
  onCancel: () => void;
}

export interface GenerationProgressProps {
  state: GenerationState;
  currentBatch: number;
  totalBatches: number;
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  wordCount: number;
  progressPercent: number;
  onCancel: () => void;
}

export interface QualityResultPanelProps {
  qualityResult: QualityResult;
}

export interface GapFillProgressProps {
  state: GenerationState;
  missingElements: string[];
}

export interface IndustryInputSectionProps {
  industryName: string;
  industryDescription: string;
  state: GenerationState;
  isUploadingGuide: boolean;
  onIndustryNameChange: (value: string) => void;
  onIndustryDescriptionChange: (value: string) => void;
  onStartClarification: () => void;
  onUploadClick: () => void;
  guideFileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadGuide: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface ResumeBannerProps {
  savedProgress: SavedProgress;
  onResume: () => void;
  onClear: () => void;
}

export interface DuplicateWarningProps {
  existingContent: string;
  onProceed: () => void;
  onCancel: () => void;
}
