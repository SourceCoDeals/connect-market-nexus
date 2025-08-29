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
  isMobile?: boolean;
}

export function PipelineKanbanColumn({ stage, deals, onDealClick, isMobile }: PipelineKanbanColumnProps) {
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
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 ${isMobile ? 'w-80' : 'w-80'} ${isOver ? 'opacity-50' : ''}`}
    >
      <Card className="h-full flex flex-col border-border/50 bg-background/50 backdrop-blur-sm">
        {/* Column Header */}
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-semibold text-sm text-foreground">
                {stage.name}
              </h3>
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                {stage.dealCount}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Stage Metrics */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Value</span>
              <span className="font-medium text-foreground">
                {formatCurrency(stage.totalValue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Probability</span>
              <span className="font-medium text-foreground">
                {stage.avgProbability.toFixed(0)}%
              </span>
            </div>
          </div>
        </CardHeader>
        
        {/* Deals List */}
        <CardContent className="flex-1 p-3 space-y-3 overflow-y-auto">
          {deals.map((deal) => (
            <PipelineKanbanCard 
              key={deal.deal_id}
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
            Add Deal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}