import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AddTranscriptDialog } from "@/components/ma-intelligence/AddTranscriptDialog";
import { useAICommandCenterContext } from "@/components/ai-command-center/AICommandCenterProvider";
import { useDealDetailData } from "./useDealDetailData";
import { DealDetailHeader } from "./DealDetailHeader";
import { DealDetailTabs } from "./DealDetailTabs";
import type { ScoringAdjustmentsState } from "./types";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setPageContext } = useAICommandCenterContext();

  useEffect(() => {
    setPageContext({ page: 'deal_detail', entity_type: 'deal', entity_id: id });
  }, [id, setPageContext]);

  const {
    deal,
    tracker,
    isLoading,
    activeTab,
    setActiveTab,
    editingSection,
    setEditingSection,
    isAddTranscriptDialogOpen,
    setIsAddTranscriptDialogOpen,
    formData,
    setFormData,
    scoringState,
    setScoringState,
    loadDeal,
    handleEnrich,
    handleCalculateScore,
    handleArchive,
    handleDelete,
    handleSaveSection,
    handleCancelEdit,
    handleSaveScoringAdjustments,
  } = useDealDetailData(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Deal not found</h3>
          <Button onClick={() => navigate("/admin/ma-intelligence/deals")}>
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DealDetailHeader
        deal={deal}
        tracker={tracker}
        onNavigateBack={() => navigate("/admin/ma-intelligence/deals")}
        onNavigateToTracker={(trackerId) => navigate(`/admin/ma-intelligence/trackers/${trackerId}`)}
        onCalculateScore={handleCalculateScore}
        onEnrich={handleEnrich}
        onOpenTranscriptDialog={() => setIsAddTranscriptDialogOpen(true)}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      <DealDetailTabs
        deal={deal}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        editingSection={editingSection}
        formData={formData}
        onSetFormData={setFormData}
        onEditSection={setEditingSection}
        onSaveSection={handleSaveSection}
        onCancelEdit={handleCancelEdit}
        onLoadDeal={loadDeal}
        scoringState={scoringState}
        onSetScoringState={(partial: Partial<ScoringAdjustmentsState>) =>
          setScoringState(prev => ({ ...prev, ...partial }))
        }
        onSaveScoringAdjustments={handleSaveScoringAdjustments}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Add Transcript Dialog */}
      <AddTranscriptDialog
        dealId={deal.id}
        isOpen={isAddTranscriptDialogOpen}
        onClose={() => setIsAddTranscriptDialogOpen(false)}
        onAdd={() => {
          if (activeTab === "transcripts") {
            loadDeal();
          }
        }}
      />
    </div>
  );
}
