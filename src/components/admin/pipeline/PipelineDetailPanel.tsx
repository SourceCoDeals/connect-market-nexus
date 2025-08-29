import React from 'react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  Phone, 
  Mail, 
  Building2, 
  Calendar, 
  DollarSign,
  User,
  MapPin,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PipelineDetailPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineDetailPanel({ pipeline }: PipelineDetailPanelProps) {
  const { selectedDeal } = pipeline;
  
  if (!selectedDeal) {
    return (
      <div className="w-96 border-l border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Select a deal to view details</p>
        </div>
      </div>
    );
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(selectedDeal.deal_stage_entered_at).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  
  const isOverdue = selectedDeal.next_followup_due && 
    new Date(selectedDeal.next_followup_due) < new Date();
  
  return (
    <div className="w-96 border-l border-border/50 bg-background/95 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Deal Details</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => pipeline.setSelectedDeal(null)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Deal Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedDeal.deal_title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={selectedDeal.deal_priority === 'urgent' ? 'destructive' : 'secondary'}>
                {selectedDeal.deal_priority} priority
              </Badge>
              {isOverdue && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deal Value</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(selectedDeal.deal_value)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Probability</p>
                <p className="text-lg font-semibold text-foreground">
                  {selectedDeal.deal_probability}%
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Stage</p>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: pipeline.stages.find(s => s.id === selectedDeal.stage_id)?.color || '#6b7280'
                  }}
                />
                <p className="text-sm font-medium text-foreground">
                  {selectedDeal.stage_name}
                </p>
                <span className="text-xs text-muted-foreground">
                  ({daysInStage} days)
                </span>
              </div>
            </div>
            
            {selectedDeal.deal_expected_close_date && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Expected Close</p>
                <div className="flex items-center gap-1 text-sm text-foreground">
                  <Calendar className="h-4 w-4" />
                  {formatDistanceToNow(new Date(selectedDeal.deal_expected_close_date), { addSuffix: true })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDeal.contact_name ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedDeal.contact_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{selectedDeal.contact_name}</p>
                  {selectedDeal.contact_role && (
                    <p className="text-sm text-muted-foreground">{selectedDeal.contact_role}</p>
                  )}
                  {selectedDeal.contact_company && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {selectedDeal.contact_company}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contact information</p>
            )}
            
            <div className="flex gap-2">
              {selectedDeal.contact_phone && (
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
              {selectedDeal.contact_email && (
                <Button variant="outline" size="sm" className="flex-1">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Listing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium text-foreground mb-2">{selectedDeal.listing_title}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Revenue</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(selectedDeal.listing_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">EBITDA</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(selectedDeal.listing_ebitda)}
                  </p>
                </div>
              </div>
              {selectedDeal.listing_location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-3 w-3" />
                  {selectedDeal.listing_location}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Document Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">NDA Status</span>
                <Badge 
                  variant={selectedDeal.nda_status === 'signed' ? 'default' : 'outline'}
                  className={
                    selectedDeal.nda_status === 'signed' ? 'bg-green-100 text-green-800 border-green-200' :
                    selectedDeal.nda_status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    selectedDeal.nda_status === 'declined' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-gray-100 text-gray-800 border-gray-200'
                  }
                >
                  {selectedDeal.nda_status.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Fee Agreement</span>
                <Badge 
                  variant={selectedDeal.fee_agreement_status === 'signed' ? 'default' : 'outline'}
                  className={
                    selectedDeal.fee_agreement_status === 'signed' ? 'bg-green-100 text-green-800 border-green-200' :
                    selectedDeal.fee_agreement_status === 'sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    selectedDeal.fee_agreement_status === 'declined' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-gray-100 text-gray-800 border-gray-200'
                  }
                >
                  {selectedDeal.fee_agreement_status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tasks & Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks & Activities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-foreground">{selectedDeal.total_tasks}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-orange-600">{selectedDeal.pending_tasks}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-green-600">{selectedDeal.completed_tasks}</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Activities</span>
              <span className="font-medium text-foreground">{selectedDeal.activity_count}</span>
            </div>
          </CardContent>
        </Card>
        
        {/* Assignment */}
        {selectedDeal.assigned_admin_name && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned To</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {selectedDeal.assigned_admin_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {selectedDeal.assigned_admin_name}
                  </p>
                  {selectedDeal.assigned_admin_email && (
                    <p className="text-xs text-muted-foreground">
                      {selectedDeal.assigned_admin_email}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Actions */}
      <div className="border-t border-border/50 p-4">
        <div className="space-y-2">
          <Button className="w-full" size="sm">
            Edit Deal
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm">
              Add Task
            </Button>
            <Button variant="outline" size="sm">
              Log Activity
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}