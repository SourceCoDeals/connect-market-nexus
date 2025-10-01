
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { PipelineKanbanCard } from './PipelineKanbanCard';

interface StageWithMetrics {
  id: string;
  name: string;
  color: string;
  position: number;
  dealCount: number;
  totalValue: number;
  avgProbability: number;
  deals: Deal[];
}

interface PipelineKanbanColumnProps {
  stage: StageWithMetrics;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}

export function PipelineKanbanColumn({ stage, deals, onDealClick }: PipelineKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });
  
  const formatCurrency = (value: number) => {
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
      className={`h-full flex flex-col transition-colors duration-200 ${
        isOver ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-card/50'
      }`}
    >
      {/* Column Header */}
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-sm text-foreground truncate">
              {stage.name}
            </h3>
            <Badge variant="secondary" className="h-5 px-2 text-xs flex-shrink-0">
              {stage.dealCount}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Stage Metrics - Enhanced with Company Stats */}
        {stage.dealCount > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Value</span>
              <span className="font-medium text-foreground">
                {formatCurrency(stage.totalValue)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avg Prob</span>
              <span className="font-medium text-foreground">
                {stage.avgProbability.toFixed(0)}%
              </span>
            </div>
            {(() => {
              const uniqueCompanies = new Set(
                deals.map(d => d.contact_company || d.buyer_company).filter(Boolean)
              );
              if (uniqueCompanies.size > 0) {
                return (
                  <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Companies</span>
                    <span className="font-medium text-foreground">
                      {uniqueCompanies.size}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </CardHeader>
      
      {/* Deals List */}
      <CardContent 
        ref={setNodeRef}
        className="flex-1 p-3 pt-0 overflow-y-auto"
      >
        <div className="space-y-3 min-h-full">
          {deals.map((deal, index) => (
            <PipelineKanbanCard 
              key={`${deal.deal_id}-${index}`}
              deal={deal}
              onDealClick={onDealClick}
            />
          ))}
          
          {/* Add Deal Button */}
          <Button
            variant="ghost"
            className="w-full h-12 border-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Deal</span>
            <span className="sm:hidden">Add</span>
          </Button>
          
          {/* Empty State */}
          {deals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <div className="text-sm opacity-75">No deals</div>
              <div className="text-xs mt-1 opacity-50">Drag deals here</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
