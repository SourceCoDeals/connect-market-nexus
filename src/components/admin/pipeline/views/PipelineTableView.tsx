import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  MoreVertical,
  ArrowUpDown,
  ExternalLink,
  Phone,
  Mail
} from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow } from 'date-fns';

interface PipelineTableViewProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineTableView({ pipeline }: PipelineTableViewProps) {
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
  
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-green-100 text-green-800 border-green-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'declined': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Table Header Actions */}
        <div className="border-b border-border/50 bg-background/50 px-4 py-3">
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
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm">
              <TableRow className="border-border/50">
                <TableHead className="w-12">
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
                </TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold">
                    Value <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold">
                    Stage <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold">
                    Priority <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold">
                    Days in Stage <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Expected Close</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipeline.deals.map((deal) => (
                <TableRow 
                  key={deal.deal_id}
                  className={`
                    cursor-pointer transition-colors hover:bg-muted/50 border-border/30
                    ${pipeline.selectedDeals.includes(deal.deal_id) ? 'bg-primary/5' : ''}
                    ${isOverdue(deal) ? 'bg-red-50/50' : ''}
                  `}
                  onClick={() => pipeline.handleDealSelect(deal)}
                >
                  <TableCell>
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
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm text-foreground mb-1">
                        {deal.deal_title}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {deal.listing_title}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-4 w-4 p-0 ml-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {deal.contact_name ? deal.contact_name.charAt(0).toUpperCase() : 'D'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {deal.contact_name || 'No contact'}
                        </div>
                        {deal.contact_company && (
                          <div className="text-xs text-muted-foreground">
                            {deal.contact_company}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {deal.contact_phone && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-4 w-4 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                          {deal.contact_email && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-4 w-4 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        {formatCurrency(deal.deal_value)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {deal.deal_probability}% probability
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getStageColor(deal.stage_id) }}
                      />
                      <span className="text-sm text-foreground">{deal.stage_name}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge className={`${getPriorityColor(deal.deal_priority)} text-xs`}>
                      {deal.deal_priority}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusBadgeColor(deal.nda_status)}`}
                      >
                        NDA: {deal.nda_status}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusBadgeColor(deal.fee_agreement_status)}`}
                      >
                        Fee: {deal.fee_agreement_status}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm text-foreground">
                      {daysInStage(deal)} days
                    </div>
                    {isOverdue(deal) && (
                      <Badge variant="destructive" className="text-xs mt-1">
                        Overdue
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {deal.deal_expected_close_date ? (
                      <div className="text-sm text-foreground">
                        {formatDistanceToNow(new Date(deal.deal_expected_close_date), { addSuffix: true })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}