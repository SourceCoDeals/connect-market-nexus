import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { PipelineDetailOverview } from './tabs/PipelineDetailOverview';
import { PipelineDetailBuyer } from './tabs/PipelineDetailBuyer';
import { PipelineDetailDocuments } from './tabs/PipelineDetailDocuments';
import { PipelineDetailTasks } from './tabs/PipelineDetailTasks';
import { PipelineDetailCommunication } from './tabs/PipelineDetailCommunication';
import { PipelineDetailActivity } from './tabs/PipelineDetailActivity';

interface PipelineDetailPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineDetailPanel({ pipeline }: PipelineDetailPanelProps) {
  const { selectedDeal } = pipeline;
  const [activeTab, setActiveTab] = useState('overview');

  console.log('[Pipeline Detail Panel] Rendering with selectedDeal', { 
    hasSelectedDeal: !!selectedDeal,
    dealId: selectedDeal?.deal_id,
    title: selectedDeal?.deal_title,
    contact: selectedDeal?.contact_name,
    company: selectedDeal?.contact_company
  });

  if (!selectedDeal) {
    return (
      <div className="w-[600px] border-l bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted/10 rounded-2xl flex items-center justify-center">
            <div className="w-8 h-8 bg-muted/30 rounded-xl" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Select a deal</p>
            <p className="text-xs text-muted-foreground">Choose from the pipeline to view details</p>
          </div>
        </div>
      </div>
    );
  }

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High Priority', score: 95, variant: 'high' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium Priority', score: 75, variant: 'medium' };
      case 'individual':
        if (score && score >= 70) return { level: 'High Priority', score, variant: 'high' };
        if (score && score >= 40) return { level: 'Medium Priority', score, variant: 'medium' };
        return { level: 'Standard', score: score || 25, variant: 'standard' };
      default:
        return { level: 'Standard', score: 25, variant: 'standard' };
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'Private Equity';
      case 'familyOffice': return 'Family Office';
      case 'searchFund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'individual': return 'Individual';
      case 'independentSponsor': return 'Independent Sponsor';
      default: return 'Unknown';
    }
  };

  const buyerPriority = getBuyerPriority(selectedDeal.buyer_type, selectedDeal.buyer_priority_score);

  return (
    <div className="w-[600px] border-l bg-background flex flex-col min-h-0">
      {/* Ultra-minimal Apple header */}
      <div className="px-8 py-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="space-y-1">
              <h1 className="text-xl font-medium text-foreground tracking-tight">
                {selectedDeal.deal_title}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedDeal.contact_name}
                </span>
                {selectedDeal.contact_company && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm text-muted-foreground">
                      {selectedDeal.contact_company}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                buyerPriority.variant === 'high' ? 'bg-emerald-50 text-emerald-700' :
                buyerPriority.variant === 'medium' ? 'bg-amber-50 text-amber-700' :
                'bg-muted/50 text-muted-foreground'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  buyerPriority.variant === 'high' ? 'bg-emerald-500' :
                  buyerPriority.variant === 'medium' ? 'bg-amber-500' :
                  'bg-muted-foreground'
                }`} />
                {buyerPriority.level}
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {getBuyerTypeLabel(selectedDeal.buyer_type)}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pipeline.setSelectedDeal(null)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Minimal tab navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-8 mb-6">
          <TabsList className="grid w-full grid-cols-6 bg-muted/30 h-10 rounded-lg p-1">
            <TabsTrigger value="overview" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Overview
            </TabsTrigger>
            <TabsTrigger value="buyer" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Buyer
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Documents
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Email
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailOverview deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="buyer" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailBuyer deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="tasks" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailTasks deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="documents" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailDocuments deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="communication" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailCommunication deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="activity" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailActivity deal={selectedDeal} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}