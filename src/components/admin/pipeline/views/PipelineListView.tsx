import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  Clock,
  AlertCircle,
  Phone,
  Mail,
  MoreVertical
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow } from 'date-fns';

interface PipelineListViewProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineListView({ pipeline }: PipelineListViewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 100000 ? 'compact' : 'standard',
    }).format(value);
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getStageColor = (stageId: string) => {
    const stage = pipeline.stages.find(s => s.id === stageId);
    return stage?.color || '#6b7280';
  };
  
  const daysInStage = (deal: Deal) => {
    return Math.floor(
      (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
  };
  
  const isOverdue = (deal: Deal) => {
    return deal.next_followup_due && new Date(deal.next_followup_due) < new Date();
  };
  
  if (pipeline.deals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/10">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground mb-2">No deals found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or create a new deal</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 space-y-3">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={pipeline.selectedDeals.length === pipeline.deals.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  pipeline.handleMultiSelect(pipeline.deals.map(d => d.deal_id));
                } else {
                  pipeline.handleMultiSelect([]);
                }
              }}
            />
            <span className="text-sm text-muted-foreground">
              {pipeline.selectedDeals.length > 0 
                ? `${pipeline.selectedDeals.length} selected`
                : `${pipeline.deals.length} deals`
              }
            </span>
          </div>
          
          {pipeline.selectedDeals.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Bulk Actions
              </Button>
            </div>
          )}
        </div>
        
        {/* Deals List */}
        <div className="space-y-2">
          {pipeline.deals.map((deal) => (
            <Card 
              key={deal.deal_id}
              className={`
                transition-all duration-200 hover:shadow-sm border-border/50 cursor-pointer
                ${pipeline.selectedDeals.includes(deal.deal_id) ? 'border-primary bg-primary/5' : 'bg-background/80'}
                ${isOverdue(deal) ? 'border-red-200 bg-red-50/30' : ''}
                backdrop-blur-sm
              `}
              onClick={() => pipeline.handleDealSelect(deal)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Selection Checkbox */}
                  <Checkbox 
                    checked={pipeline.selectedDeals.includes(deal.deal_id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        pipeline.handleMultiSelect([...pipeline.selectedDeals, deal.deal_id]);
                      } else {
                        pipeline.handleMultiSelect(pipeline.selectedDeals.filter(id => id !== deal.deal_id));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  {/* Contact Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-muted">
                      {deal.contact_name ? deal.contact_name.charAt(0).toUpperCase() : 'D'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Deal Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {deal.deal_title}
                          </h3>
                          {(deal.deal_priority === 'high' || deal.deal_priority === 'urgent') && (
                            <Badge className={`${getPriorityColor(deal.deal_priority)} h-5 px-1.5 text-xs`}>
                              {deal.deal_priority}
                            </Badge>
                          )}
                          {isOverdue(deal) && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{deal.listing_title}</span>
                          </div>
                          {deal.contact_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">{deal.contact_name}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1 font-semibold text-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(deal.deal_value)}
                          </div>
                          <span className="text-muted-foreground">
                            {deal.deal_probability}% probability
                          </span>
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getStageColor(deal.stage_id) }}
                            />
                            <span className="text-muted-foreground">{deal.stage_name}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Side Info */}
                      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{daysInStage(deal)} days in stage</span>
                        </div>
                        
                        {deal.deal_expected_close_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(deal.deal_expected_close_date), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          {deal.nda_status === 'signed' && (
                            <Badge variant="outline" className="h-4 px-1 text-xs bg-green-50 text-green-700 border-green-200">
                              NDA
                            </Badge>
                          )}
                          {deal.fee_agreement_status === 'signed' && (
                            <Badge variant="outline" className="h-4 px-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Fee
                            </Badge>
                          )}
                          {deal.pending_tasks > 0 && (
                            <Badge variant="outline" className="h-4 px-1 text-xs bg-orange-50 text-orange-700 border-orange-200">
                              {deal.pending_tasks}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}