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

  if (!selectedDeal) {
    return (
      <div className="w-96 border-l bg-muted/5 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-muted/20 rounded-xl flex items-center justify-center">
            <div className="w-6 h-6 bg-muted rounded" />
          </div>
          <p className="text-muted-foreground text-sm">Select a deal to view details</p>
        </div>
      </div>
    );
  }

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', score: 95, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', score: 75, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', score, color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (score && score >= 40) return { level: 'Medium', score, color: 'text-amber-600', bg: 'bg-amber-50' };
        return { level: 'Standard', score: score || 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
      default:
        return { level: 'Standard', score: 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
  };

  const buyerPriority = getBuyerPriority(selectedDeal.buyer_type, selectedDeal.buyer_priority_score);

  return (
    <div className="w-[800px] border-l bg-background flex flex-col min-h-0">
      {/* Apple-inspired header with sophisticated layout */}
      <div className="px-8 py-6 border-b border-border/30">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            {/* Deal info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg leading-tight text-foreground tracking-tight">
                {selectedDeal.deal_title}
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm text-muted-foreground">{selectedDeal.contact_name}</span>
                </div>
                {selectedDeal.contact_company && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                    <span className="text-sm text-muted-foreground">{selectedDeal.contact_company}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Buyer priority badge - compact in header */}
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={`text-xs font-medium px-3 py-1 ${buyerPriority.bg} ${buyerPriority.color} border-0`}
              >
                {buyerPriority.level} Priority • {buyerPriority.score}/100
              </Badge>
            </div>
          </div>
          
          {/* Header actions */}
          <div className="flex items-center gap-3">
            {/* Quick contact actions */}
            {selectedDeal.contact_phone && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => window.open(`tel:${selectedDeal.contact_phone}`)}
              >
                Call
              </Button>
            )}
            {selectedDeal.contact_email && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => window.open(`mailto:${selectedDeal.contact_email}`)}
              >
                Email
              </Button>
            )}
            
            <div className="w-px h-4 bg-border/40"></div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pipeline.setSelectedDeal(null)}
              className="h-8 w-8 p-0 hover:bg-muted/60"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs navigation - Apple sophistication */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-8 py-4 border-b border-border/30">
          <TabsList className="grid w-full grid-cols-6 bg-muted/20 p-1 h-10 rounded-lg">
            <TabsTrigger value="overview" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Overview
            </TabsTrigger>
            <TabsTrigger value="buyer" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Buyer
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Documents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Email
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground rounded-md">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content with proper scrolling */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailOverview deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="buyer" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailBuyer deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="documents" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailDocuments deal={selectedDeal} />
          </TabsContent>
          
          <TabsContent value="tasks" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <PipelineDetailTasks deal={selectedDeal} />
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