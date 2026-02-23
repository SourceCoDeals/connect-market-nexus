import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, ArrowLeft, Sparkles, MoreVertical, Archive, Trash2, CheckCircle, XCircle, Info } from "lucide-react";
import { IntelligenceBadge } from "@/components/ma-intelligence";
import { getIntelligenceCoverage, calculateIntelligencePercentage } from "@/lib/ma-intelligence/types";
import { BuyerDealHistoryTab } from "@/components/ma-intelligence/BuyerDealHistoryTab";
import { BuyerContactsTab } from "@/components/ma-intelligence/BuyerContactsTab";
import { BuyerActivitySection } from "@/components/ma-intelligence/BuyerActivitySection";
import { BuyerAgreementsPanel } from "@/components/ma-intelligence/BuyerAgreementsPanel";
import { PassReasonDialog } from "@/components/ma-intelligence/PassReasonDialog";

import { useBuyerDetail } from "./useBuyerDetail";
import { BuyerOverviewTab } from "./BuyerOverviewTab";

export default function BuyerDetail() {
  const {
    dealId, buyer, isLoading, activeTab, setActiveTab,
    editingSection, setEditingSection, isPassDialogOpen, setIsPassDialogOpen,
    isAnalyzingNotes, formData, setFormData,
    loadBuyer, handleEnrich, handleArchive, handleDelete,
    handleApproveForDeal, handleSaveSection, handleCancelEdit,
    handleSaveNotes, handleAnalyzeNotes, navigate, toast,
  } = useBuyerDetail();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!buyer) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><h3 className="text-lg font-semibold mb-2">Buyer not found</h3><Button onClick={() => navigate("/admin/ma-intelligence/buyers")}>Back to Buyers</Button></div></div>;
  }

  const coverage = getIntelligenceCoverage(buyer);
  const percentage = calculateIntelligencePercentage(buyer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/ma-intelligence/buyers")}><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold">{buyer.platform_company_name || buyer.pe_firm_name}</h1>
              {buyer.platform_company_name && <p className="text-muted-foreground">PE Firm: {buyer.pe_firm_name}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IntelligenceBadge coverage={coverage} />
          <Badge variant="secondary">{percentage}% complete</Badge>
          {buyer.fee_agreement_status && <Badge variant={buyer.fee_agreement_status === "Active" ? "default" : buyer.fee_agreement_status === "Expired" ? "secondary" : "outline"}>{buyer.fee_agreement_status}</Badge>}
          {buyer.addon_only && <Badge variant="outline">Add-on Only</Badge>}
          {buyer.platform_only && <Badge variant="outline">Platform Only</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><MoreVertical className="w-4 h-4 mr-2" />Actions</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEnrich}><Sparkles className="w-4 h-4 mr-2" />Enrich Buyer</DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}><Archive className="w-4 h-4 mr-2" />Archive Buyer</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete Buyer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Deal Context Banner */}
      {dealId && (
        <Alert><Info className="h-4 w-4" /><AlertDescription className="flex items-center justify-between"><span>Viewing in deal context</span><div className="flex items-center gap-2"><Button size="sm" onClick={handleApproveForDeal}><CheckCircle className="w-4 h-4 mr-1" />Approve for this Deal</Button><Button size="sm" variant="outline" onClick={() => setIsPassDialogOpen(true)}><XCircle className="w-4 h-4 mr-1" />Pass on this Deal</Button></div></AlertDescription></Alert>
      )}

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Location</CardTitle></CardHeader><CardContent><div className="text-sm">{buyer.hq_city && buyer.hq_state ? `${buyer.hq_city}, ${buyer.hq_state}` : buyer.hq_state || "\u2014"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue Range</CardTitle></CardHeader><CardContent><div className="text-sm">{buyer.min_revenue || buyer.max_revenue ? `$${buyer.min_revenue || 0}M - $${buyer.max_revenue || "\u221E"}M` : "\u2014"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">EBITDA Range</CardTitle></CardHeader><CardContent><div className="text-sm">{buyer.min_ebitda || buyer.max_ebitda ? `$${buyer.min_ebitda || 0}M - $${buyer.max_ebitda || "\u221E"}M` : "\u2014"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Acquisitions</CardTitle></CardHeader><CardContent><div className="text-sm">{buyer.total_acquisitions || 0} total{buyer.acquisition_frequency && <span className="text-muted-foreground ml-1">- {buyer.acquisition_frequency}</span>}</div></CardContent></Card>
      </div>

      {/* Tabs */}
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

        <TabsContent value="overview">
          <BuyerOverviewTab buyer={buyer} formData={formData} setFormData={setFormData} editingSection={editingSection} setEditingSection={setEditingSection} handleSaveSection={handleSaveSection} handleCancelEdit={handleCancelEdit} handleSaveNotes={handleSaveNotes} handleAnalyzeNotes={handleAnalyzeNotes} isAnalyzingNotes={isAnalyzingNotes} />
        </TabsContent>

        <TabsContent value="agreements">
          <BuyerAgreementsPanel buyerId={buyer.id} marketplaceFirmId={buyer.marketplace_firm_id} hasFeeAgreement={buyer.has_fee_agreement || false} feeAgreementSource={buyer.fee_agreement_source} />
        </TabsContent>

        <TabsContent value="deal-history"><BuyerDealHistoryTab buyerId={buyer.id} /></TabsContent>
        <TabsContent value="contacts"><BuyerContactsTab buyerId={buyer.id} /></TabsContent>
        <TabsContent value="transcripts"><Card><CardHeader><CardTitle>Transcripts & Calls</CardTitle><CardDescription>Call recordings and transcript analysis</CardDescription></CardHeader><CardContent><div className="text-center py-12 text-muted-foreground"><p>Transcript management coming soon</p></div></CardContent></Card></TabsContent>
        <TabsContent value="activity"><BuyerActivitySection buyerId={buyer.id} /></TabsContent>
        <TabsContent value="settings">
          <Card><CardHeader><CardTitle>Settings</CardTitle><CardDescription>Buyer settings and data management</CardDescription></CardHeader><CardContent className="space-y-4">
            <div><h4 className="text-sm font-medium mb-2">Data Management</h4><div className="space-y-2"><div className="text-sm text-muted-foreground">Last enriched: {buyer.data_last_updated || "Never"}</div><div className="text-sm text-muted-foreground">Created: {new Date(buyer.created_at).toLocaleDateString()}</div></div></div>
            <div><h4 className="text-sm font-medium mb-2">Data Completeness</h4><div className="text-sm text-muted-foreground">{percentage}% complete</div></div>
            <div><h4 className="text-sm font-medium mb-2">Actions</h4><div className="flex items-center gap-2"><Button variant="outline" onClick={handleArchive}><Archive className="w-4 h-4 mr-2" />Archive Buyer</Button><Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" />Delete Buyer</Button></div></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {dealId && <PassReasonDialog buyerId={buyer.id} dealId={dealId} isOpen={isPassDialogOpen} onClose={() => setIsPassDialogOpen(false)} onPass={() => { toast({ title: "Passed on deal", description: "The buyer has been marked as passed for this deal" }); loadBuyer(); }} />}
    </div>
  );
}
