import type { MABuyer } from "@/lib/ma-intelligence/types";

export interface BuyerDetailHeaderProps {
  buyer: MABuyer;
  coverage: string;
  percentage: number;
  onNavigateBack: () => void;
  onEnrich: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export interface DealContextBannerProps {
  dealId: string;
  onApprove: () => void;
  onPass: () => void;
}

export interface QuickInfoCardsProps {
  buyer: MABuyer;
}

export interface OverviewTabProps {
  buyer: MABuyer;
  editingSection: string | null;
  formData: Partial<MABuyer>;
  isAnalyzingNotes: boolean;
  onSetEditingSection: (section: string | null) => void;
  onSetFormData: (data: Partial<MABuyer>) => void;
  onSaveSection: (section: string) => void;
  onCancelEdit: (section: string) => void;
  onSaveNotes: (notes: string) => Promise<void>;
  onAnalyzeNotes: (notes: string) => Promise<void>;
}

export interface SettingsTabProps {
  buyer: MABuyer;
  percentage: number;
  onArchive: () => void;
  onDelete: () => void;
}

/** Shared props passed to each editable data section in the overview tab. */
export interface BuyerSectionProps {
  buyer: MABuyer;
  isEditing: boolean;
  formData: Partial<MABuyer>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSetFormData: (data: Partial<MABuyer>) => void;
}
