import { BuyerNotesSection } from "@/components/remarketing/buyer-detail/BuyerNotesSection";
import { BusinessSummarySection } from "./BusinessSummarySection";
import { ThesisPreferencesSection } from "./ThesisPreferencesSection";
import { SizeCriteriaSection } from "./SizeCriteriaSection";
import { GeographicPreferencesSection } from "./GeographicPreferencesSection";
import { AcquisitionStrategySection } from "./AcquisitionStrategySection";
import { OwnerTransitionSection } from "./OwnerTransitionSection";
import { PortfolioOperationsSection } from "./PortfolioOperationsSection";
import { ContactInfoSection } from "./ContactInfoSection";
import type { OverviewTabProps } from "./types";

export function OverviewTab({
  buyer,
  editingSection,
  formData,
  isAnalyzingNotes,
  onSetEditingSection,
  onSetFormData,
  onSaveSection,
  onCancelEdit,
  onSaveNotes,
  onAnalyzeNotes,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* General Notes Section */}
      <BuyerNotesSection
        notes={buyer.notes}
        onSave={onSaveNotes}
        isAnalyzing={isAnalyzingNotes}
        onAnalyze={onAnalyzeNotes}
      />

      {/* Business Summary Section */}
      <BusinessSummarySection
        buyer={buyer}
        isEditing={editingSection === "business"}
        formData={formData}
        onEdit={() => onSetEditingSection("business")}
        onSave={() => onSaveSection("business")}
        onCancel={() => onCancelEdit("business")}
        onSetFormData={onSetFormData}
      />

      {/* Thesis & Preferences Section */}
      <ThesisPreferencesSection
        buyer={buyer}
        isEditing={editingSection === "thesis"}
        formData={formData}
        onEdit={() => onSetEditingSection("thesis")}
        onSave={() => onSaveSection("thesis")}
        onCancel={() => onCancelEdit("thesis")}
        onSetFormData={onSetFormData}
      />

      {/* Size Criteria Section */}
      <SizeCriteriaSection
        buyer={buyer}
        isEditing={editingSection === "size"}
        formData={formData}
        onEdit={() => onSetEditingSection("size")}
        onSave={() => onSaveSection("size")}
        onCancel={() => onCancelEdit("size")}
        onSetFormData={onSetFormData}
      />

      {/* Geographic Preferences Section */}
      <GeographicPreferencesSection
        buyer={buyer}
        isEditing={editingSection === "geography"}
        formData={formData}
        onEdit={() => onSetEditingSection("geography")}
        onSave={() => onSaveSection("geography")}
        onCancel={() => onCancelEdit("geography")}
        onSetFormData={onSetFormData}
      />

      {/* Acquisition Strategy Section */}
      <AcquisitionStrategySection
        buyer={buyer}
        isEditing={editingSection === "acquisition"}
        formData={formData}
        onEdit={() => onSetEditingSection("acquisition")}
        onSave={() => onSaveSection("acquisition")}
        onCancel={() => onCancelEdit("acquisition")}
        onSetFormData={onSetFormData}
      />

      {/* Owner Transition Section */}
      <OwnerTransitionSection
        buyer={buyer}
        isEditing={editingSection === "owner"}
        formData={formData}
        onEdit={() => onSetEditingSection("owner")}
        onSave={() => onSaveSection("owner")}
        onCancel={() => onCancelEdit("owner")}
        onSetFormData={onSetFormData}
      />

      {/* Portfolio & Operations Section */}
      <PortfolioOperationsSection
        buyer={buyer}
        isEditing={editingSection === "portfolio"}
        formData={formData}
        onEdit={() => onSetEditingSection("portfolio")}
        onSave={() => onSaveSection("portfolio")}
        onCancel={() => onCancelEdit("portfolio")}
        onSetFormData={onSetFormData}
      />

      {/* Contact Information Section */}
      <ContactInfoSection
        buyer={buyer}
        isEditing={editingSection === "contact"}
        formData={formData}
        onEdit={() => onSetEditingSection("contact")}
        onSave={() => onSaveSection("contact")}
        onCancel={() => onCancelEdit("contact")}
        onSetFormData={onSetFormData}
      />
    </div>
  );
}
