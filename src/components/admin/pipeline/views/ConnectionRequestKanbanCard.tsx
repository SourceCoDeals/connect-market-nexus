import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, Mail, Phone, Clock, AlertTriangle, FileCheck, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ConnectionRequestPipelineItem } from '@/hooks/admin/use-connection-request-pipeline';

interface ConnectionRequestKanbanCardProps {
  request: ConnectionRequestPipelineItem;
  onRequestClick: (requestId: string) => void;
  isDragging?: boolean;
}

export function ConnectionRequestKanbanCard({ 
  request, 
  onRequestClick, 
  isDragging = false 
}: ConnectionRequestKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: request.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 5) return 'bg-red-500';
    if (score >= 4) return 'bg-orange-500';
    if (score >= 3) return 'bg-yellow-500';
    if (score >= 2) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 5) return 'Critical';
    if (score >= 4) return 'High';
    if (score >= 3) return 'Medium';
    if (score >= 2) return 'Low';
    return 'Minimal';
  };

  const getBuyerTypeColor = (buyerType: string) => {
    const type = buyerType?.toLowerCase() || '';
    if (type.includes('pe') || type.includes('private equity')) return 'bg-purple-100 text-purple-800';
    if (type.includes('corporate') || type.includes('strategic')) return 'bg-blue-100 text-blue-800';
    if (type.includes('independent') || type.includes('family office')) return 'bg-green-100 text-green-800';
    if (type.includes('search fund')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const documentsComplete = request.user?.nda_signed && request.user?.fee_agreement_signed;
  const hasPartialDocuments = request.user?.nda_signed || request.user?.fee_agreement_signed;

  const daysInStage = request.stage_entered_at 
    ? Math.floor((Date.now() - new Date(request.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isOverdue = daysInStage > 7; // Consider overdue after 7 days

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-pointer hover:shadow-md transition-all ${
        isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''
      } ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={() => onRequestClick(request.id)}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header: Buyer Info & Priority */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="text-xs">
                {request.user?.first_name?.[0]}{request.user?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">
                {request.user?.first_name} {request.user?.last_name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {request.user?.company}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div 
              className={`w-2 h-2 rounded-full ${getPriorityColor(request.buyer_priority_score)}`}
              title={`Priority: ${getPriorityLabel(request.buyer_priority_score)}`}
            />
            {isOverdue && (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
          </div>
        </div>

        {/* Buyer Type & Contact Info */}
        <div className="space-y-2">
          {request.user?.buyer_type && (
            <Badge 
              variant="secondary" 
              className={`text-xs ${getBuyerTypeColor(request.user.buyer_type)}`}
            >
              {request.user.buyer_type}
            </Badge>
          )}
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{request.user?.email}</span>
            </div>
            {request.user?.phone_number && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <span className="truncate">{request.user.phone_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* Listing Info */}
        <div className="space-y-1 p-2 bg-muted/50 rounded">
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium truncate">
              {request.listing?.title}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{request.listing?.location}</span>
            {request.listing?.revenue && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>{formatCurrency(request.listing.revenue)}</span>
              </div>
            )}
          </div>
          {request.listing?.deal_identifier && (
            <div className="text-xs text-muted-foreground">
              ID: {request.listing.deal_identifier}
            </div>
          )}
        </div>

        {/* Document Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <FileCheck className={`h-3 w-3 ${request.user?.nda_signed ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-xs">NDA</span>
            </div>
            <div className="flex items-center gap-1">
              <FileCheck className={`h-3 w-3 ${request.user?.fee_agreement_signed ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-xs">Fee</span>
            </div>
          </div>
          
          {documentsComplete ? (
            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
              Ready
            </Badge>
          ) : hasPartialDocuments ? (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
              Partial
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-red-500 text-red-700">
              Pending
            </Badge>
          )}
        </div>

        {/* Timeline Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{daysInStage}d in stage</span>
          </div>
          <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}