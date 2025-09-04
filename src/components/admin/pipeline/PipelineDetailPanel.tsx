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
        return { level: 'High', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (score && score >= 40) return { level: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' };
        return { level: 'Standard', color: 'text-muted-foreground', bg: 'bg-muted/50' };
      default:
        return { level: 'Standard', color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
  };

  const buyerPriority = getBuyerPriority(selectedDeal.buyer_type, selectedDeal.buyer_priority_score);

  return (
    <div className="w-[550px] border-l bg-background flex flex-col min-h-0">
      {/* Apple-inspired header with minimal design */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-[15px] leading-tight text-foreground">
              {selectedDeal.deal_title}
            </h3>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={`text-xs font-medium ${buyerPriority.bg} ${buyerPriority.color} border-0`}
              >
                {buyerPriority.level} Priority
              </Badge>
              {selectedDeal.deal_priority && (
                <Badge variant="outline" className="text-xs font-medium border-border/60">
                  {selectedDeal.deal_priority}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pipeline.setSelectedDeal(null)}
          className="h-8 w-8 p-0 hover:bg-muted/60"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs navigation - Apple style */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-3 border-b border-border/40">
          <TabsList className="grid w-full grid-cols-6 bg-muted/30 p-1 h-9">
            <TabsTrigger value="overview" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="buyer" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Buyer
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Documents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Email
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
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