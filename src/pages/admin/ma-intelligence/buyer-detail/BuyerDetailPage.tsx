import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";
import { BuyerDealHistoryTab } from "@/components/ma-intelligence/BuyerDealHistoryTab";
import { BuyerContactsTab } from "@/components/ma-intelligence/BuyerContactsTab";
import { BuyerActivitySection } from "@/components/ma-intelligence/BuyerActivitySection";
import { BuyerAgreementsPanel } from "@/components/ma-intelligence/BuyerAgreementsPanel";
import { PassReasonDialog } from "@/components/ma-intelligence/PassReasonDialog";
import { useBuyerDetail } from "./useBuyerDetail";
import { BuyerDetailHeader } from "./BuyerDetailHeader";
import { DealContextBanner } from "./DealContextBanner";
import { QuickInfoCards } from "./QuickInfoCards";
import { OverviewTab } from "./OverviewTab";
import { SettingsTab } from "./SettingsTab";

export default function BuyerDetailPage() {
  const {
    buyer,
    isLoading,
    activeTab,
    setActiveTab,
    editingSection,
    setEditingSection,
    isPassDialogOpen,
    setIsPassDialogOpen,
    isAnalyzingNotes,
    formData,
    setFormData,
    dealId,
    navigate,
    toast,
    loadBuyer,
    handleEnrich,
    handleArchive,
    handleDelete,
    handleApproveForDeal,
    handleSaveSection,
    handleCancelEdit,
    handleSaveNotes,
    handleAnalyzeNotes,
  } = useBuyerDetail();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Buyer not found</h3>
          <Button onClick={() => navigate("/admin/ma-intelligence/buyers")}>
            Back to Buyers
          </Button>
        </div>
      </div>
    );
  }

  const coverage = getIntelligenceCoverage(buyer);
  const percentage = calculateIntelligencePercentage(buyer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <BuyerDetailHeader
        buyer={buyer}
        coverage={coverage}
        percentage={percentage}
        onNavigateBack={() => navigate("/admin/ma-intelligence/buyers")}
        onEnrich={handleEnrich}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Deal Context Banner */}
      {dealId && (
        <DealContextBanner
          dealId={dealId}
          onApprove={handleApproveForDeal}
          onPass={() => setIsPassDialogOpen(true)}
        />
      )}

      {/* Quick Info Cards */}
      <QuickInfoCards buyer={buyer} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="deal-history">Deal History</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab
            buyer={buyer}
            editingSection={editingSection}
            formData={formData}
            isAnalyzingNotes={isAnalyzingNotes}
            onSetEditingSection={setEditingSection}
            onSetFormData={setFormData}
            onSaveSection={handleSaveSection}
            onCancelEdit={handleCancelEdit}
            onSaveNotes={handleSaveNotes}
            onAnalyzeNotes={handleAnalyzeNotes}
          />
        </TabsContent>

        {/* Agreements Tab */}
        <TabsContent value="agreements">
          <BuyerAgreementsPanel buyerId={buyer.id} marketplaceFirmId={buyer.marketplace_firm_id} hasFeeAgreement={buyer.has_fee_agreement || false} feeAgreementSource={buyer.fee_agreement_source} />
        </TabsContent>

        <TabsContent value="deal-history">
          <BuyerDealHistoryTab buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="contacts">
          <BuyerContactsTab buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="transcripts">
          <Card>
            <CardHeader>
              <CardTitle>Transcripts & Calls</CardTitle>
              <CardDescription>
                Call recordings and transcript analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Transcript management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <BuyerActivitySection buyerId={buyer.id} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab
            buyer={buyer}
            percentage={percentage}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Pass Reason Dialog */}
      {dealId && (
        <PassReasonDialog
          buyerId={buyer.id}
          dealId={dealId}
          isOpen={isPassDialogOpen}
          onClose={() => setIsPassDialogOpen(false)}
          onPass={() => {
            toast({
              title: "Passed on deal",
              description: "The buyer has been marked as passed for this deal",
            });
            loadBuyer();
          }}
        />
      )}
    </div>
  );
}
