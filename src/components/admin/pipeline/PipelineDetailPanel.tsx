import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Phone, Mail, Calendar, DollarSign } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

interface PipelineDetailPanelProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PipelineDetailPanel: React.FC<PipelineDetailPanelProps> = ({
  deal,
  isOpen,
  onClose
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!deal) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed lg:relative inset-y-0 right-0 w-full lg:w-96 bg-background border-l border-border/50 z-50 transform transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          !isOpen && "lg:w-0 lg:border-0"
        )}
      >
        {isOpen && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold truncate">{deal.deal_title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="overview" className="h-full">
                <TabsList className="grid w-full grid-cols-3 m-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="p-4 space-y-4">
                  {/* Deal Value */}
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">Deal Value</h3>
                    </div>
                    <p className="text-2xl font-semibold">{formatCurrency(deal.deal_value || 0)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Probability: {deal.deal_probability || 0}%
                    </p>
                  </Card>

                  {/* Contact Info */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Contact Information</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">{deal.contact_name || deal.buyer_name}</p>
                        <p className="text-sm text-muted-foreground">{deal.contact_company || deal.buyer_company}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Deal Details */}
                  <Card className="p-4">
                    <h3 className="font-medium mb-3">Deal Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stage:</span>
                        <span className="font-medium">{deal.stage_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priority:</span>
                        <span className="font-medium capitalize">{deal.deal_priority}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source:</span>
                        <span className="font-medium capitalize">{deal.deal_source}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium">
                          {new Date(deal.deal_created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Listing Info */}
                  {deal.listing_id && (
                    <Card className="p-4">
                      <h3 className="font-medium mb-3">Related Listing</h3>
                      <div className="space-y-2">
                        <p className="font-medium">{deal.listing_title}</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Revenue: {formatCurrency(deal.listing_revenue || 0)}</p>
                          <p>EBITDA: {formatCurrency(deal.listing_ebitda || 0)}</p>
                          <p>Location: {deal.listing_location}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="p-4">
                  <div className="space-y-4">
                    <Card className="p-4">
                      <h3 className="font-medium mb-3">Recent Activity</h3>
                      <p className="text-sm text-muted-foreground">
                        No recent activity to display.
                      </p>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="p-4">
                  <div className="space-y-4">
                    <Card className="p-4">
                      <h3 className="font-medium mb-3">Tasks & Follow-ups</h3>
                      <p className="text-sm text-muted-foreground">
                        No tasks assigned to this deal.
                      </p>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </>
  );
};