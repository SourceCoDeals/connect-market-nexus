import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Phone, Mail, ExternalLink } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { DealOverviewTab } from './modal/DealOverviewTab';
import { DealTasksTab } from './modal/DealTasksTab';
import { DealActivityTab } from './modal/DealActivityTab';
import { DealBuyerTab } from './modal/DealBuyerTab';
import { DealCommunicationTab } from './modal/DealCommunicationTab';
import { DealDocumentsTab } from './modal/DealDocumentsTab';
import { formatCurrency } from '@/lib/utils';

interface DealDetailModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailModal({ deal, open, onOpenChange }: DealDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!deal) return null;

  const getBuyerPriorityColor = (score: number) => {
    if (score >= 5) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (score >= 4) return 'bg-violet-100 text-violet-800 border-violet-200';
    if (score >= 3) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 2) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getBuyerPriorityLabel = (score: number) => {
    if (score >= 5) return 'Private Equity';
    if (score >= 4) return 'Strategic';
    if (score >= 3) return 'Independent Sponsor';
    if (score >= 2) return 'Search Fund';
    return 'Individual';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 overflow-hidden bg-white border-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                {deal.deal_title}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={`text-xs font-medium ${getBuyerPriorityColor(deal.buyer_priority_score || 0)}`}>
                  {getBuyerPriorityLabel(deal.buyer_priority_score || 0)}
                </Badge>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(deal.deal_value || 0)}
                </span>
                <span className="text-sm text-gray-500">
                  {deal.deal_probability}% probability
                </span>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {deal.contact_phone && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => window.open(`tel:${deal.contact_phone}`)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {deal.contact_email && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                onClick={() => window.open(`mailto:${deal.contact_email}`)}
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="mx-8 mt-4 mb-0 bg-gray-50 p-1 rounded-lg">
            <TabsTrigger 
              value="overview" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="tasks" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger 
              value="buyer" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Buyer
            </TabsTrigger>
            <TabsTrigger 
              value="communication" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Communication
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="overview" className="mt-0 h-full overflow-auto">
              <DealOverviewTab deal={deal} />
            </TabsContent>
            
            <TabsContent value="tasks" className="mt-0 h-full overflow-auto">
              <DealTasksTab dealId={deal.deal_id} />
            </TabsContent>
            
            <TabsContent value="activity" className="mt-0 h-full overflow-auto">
              <DealActivityTab dealId={deal.deal_id} />
            </TabsContent>
            
            <TabsContent value="buyer" className="mt-0 h-full overflow-auto">
              <DealBuyerTab deal={deal} />
            </TabsContent>
            
            <TabsContent value="communication" className="mt-0 h-full overflow-auto">
              <DealCommunicationTab deal={deal} />
            </TabsContent>
            
            <TabsContent value="documents" className="mt-0 h-full overflow-auto">
              <DealDocumentsTab deal={deal} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}