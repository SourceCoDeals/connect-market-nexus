import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConnectionRequestPipeline } from '@/hooks/admin/use-connection-requests-pipeline';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionRequestKanbanCardProps {
  request: ConnectionRequestPipeline;
  onSelect: (request: ConnectionRequestPipeline) => void;
  isDragging?: boolean;
}

export function ConnectionRequestKanbanCard({ 
  request, 
  onSelect, 
  isDragging = false 
}: ConnectionRequestKanbanCardProps) {
  const getPriorityColor = (score: number) => {
    if (score >= 4) return 'hsl(0 84% 60%)'; // red
    if (score >= 3) return 'hsl(25 95% 53%)'; // orange  
    if (score >= 2) return 'hsl(48 96% 53%)'; // yellow
    return 'hsl(var(--muted-foreground))';
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 1000000 ? 'compact' : 'standard',
    }).format(value);
  };

  return (
    <Card 
      className={`
        p-3 mb-3 cursor-pointer border-l-4 transition-all
        hover:shadow-md hover:border-border/80
        ${isDragging ? 'opacity-50 rotate-2' : ''}
      `}
      style={{ borderLeftColor: getPriorityColor(request.buyer_priority_score) }}
      onClick={() => onSelect(request)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground truncate">
            {request.buyer_name || 'Unknown Buyer'}
          </h4>
          <p className="text-xs text-muted-foreground truncate">
            {request.buyer_company || request.buyer_email || 'No company'}
          </p>
        </div>
        <div 
          className="w-2 h-2 rounded-full flex-shrink-0 ml-2"
          style={{ backgroundColor: getPriorityColor(request.buyer_priority_score) }}
        />
      </div>

      {/* Listing Info */}
      <div className="space-y-1 mb-2">
        <p className="text-xs font-medium text-foreground truncate">
          {request.listing_title || 'Unknown Listing'}
        </p>
        {request.listing_deal_identifier && (
          <Badge variant="outline" className="text-xs">
            {request.listing_deal_identifier}
          </Badge>
        )}
      </div>

      {/* Financial Info */}
      {(request.listing_revenue || request.listing_ebitda) && (
        <div className="flex gap-2 text-xs text-muted-foreground mb-2">
          {request.listing_revenue && (
            <span>Rev: {formatCurrency(request.listing_revenue)}</span>
          )}
          {request.listing_ebitda && (
            <span>EBITDA: {formatCurrency(request.listing_ebitda)}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="capitalize">{request.buyer_type?.toLowerCase() || 'N/A'}</span>
        <span>
          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
        </span>
      </div>
    </Card>
  );
}