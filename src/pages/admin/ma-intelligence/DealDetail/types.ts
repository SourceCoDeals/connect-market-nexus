import type { MADeal } from "@/lib/ma-intelligence/types";

export interface DealDetailState {
  deal: MADeal | null;
  tracker: { id: string; name: string } | null;
  isLoading: boolean;
  activeTab: string;
  editingSection: string | null;
  isAddTranscriptDialogOpen: boolean;
  formData: Partial<MADeal>;
}

export interface ScoringAdjustmentsState {
  geoWeightMultiplier: number;
  sizeWeightMultiplier: number;
  serviceWeightMultiplier: number;
  customScoringInstructions: string;
}

export interface DealDetailHeaderProps {
  deal: MADeal;
  tracker: { id: string; name: string } | null;
  onNavigateBack: () => void;
  onNavigateToTracker: (trackerId: string) => void;
  onCalculateScore: () => void;
  onEnrich: () => void;
  onOpenTranscriptDialog: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export interface DealDetailTabsProps {
  deal: MADeal;
  activeTab: string;
  onTabChange: (tab: string) => void;
  editingSection: string | null;
  formData: Partial<MADeal>;
  onSetFormData: (data: Partial<MADeal>) => void;
  onEditSection: (section: string) => void;
  onSaveSection: (section: string) => void;
  onCancelEdit: (section: string) => void;
  onLoadDeal: () => void;
  scoringState: ScoringAdjustmentsState;
  onSetScoringState: (state: Partial<ScoringAdjustmentsState>) => void;
  onSaveScoringAdjustments: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export interface DealDetailSidebarProps {
  deal: MADeal;
}
