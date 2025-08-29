
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import { usePipelineCore } from '@/hooks/admin/use-pipeline-core';

interface PipelineFilterPanelProps {
  pipeline: ReturnType<typeof usePipelineCore>;
}

export function PipelineFilterPanel({ pipeline }: PipelineFilterPanelProps) {
  if (!pipeline.isFilterPanelOpen) return null;

  const activeFiltersCount = [
    pipeline.dealStatus !== 'all',
    pipeline.documentStatus !== 'all',
    pipeline.selectedStages.length > 0,
    pipeline.selectedPriorities.length > 0,
    pipeline.dateRange,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 lg:relative lg:bg-transparent lg:backdrop-blur-none">
      <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg lg:relative lg:w-full lg:h-auto lg:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Filters</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={pipeline.toggleFilterPanel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Quick Filters */}
          <div>
            <h4 className="font-medium mb-3">Quick Filters</h4>
            <div className="space-y-2">
              <Button
                variant={pipeline.dealStatus === 'active' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => pipeline.setDealStatus(pipeline.dealStatus === 'active' ? 'all' : 'active')}
              >
                Active Deals
              </Button>
              <Button
                variant={pipeline.dealStatus === 'closing-soon' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => pipeline.setDealStatus(pipeline.dealStatus === 'closing-soon' ? 'all' : 'closing-soon')}
              >
                Closing Soon
              </Button>
              <Button
                variant={pipeline.documentStatus === 'pending' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => pipeline.setDocumentStatus(pipeline.documentStatus === 'pending' ? 'all' : 'pending')}
              >
                Pending Documents
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stages */}
          <div>
            <h4 className="font-medium mb-3">Stages</h4>
            <div className="space-y-2">
              {pipeline.stages.map((stage) => (
                <Button
                  key={stage.id}
                  variant={pipeline.selectedStages.includes(stage.id) ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const isSelected = pipeline.selectedStages.includes(stage.id);
                    if (isSelected) {
                      pipeline.setSelectedStages(pipeline.selectedStages.filter(id => id !== stage.id));
                    } else {
                      pipeline.setSelectedStages([...pipeline.selectedStages, stage.id]);
                    }
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Priorities */}
          <div>
            <h4 className="font-medium mb-3">Priority</h4>
            <div className="space-y-2">
              {['urgent', 'high', 'medium', 'low'].map((priority) => (
                <Button
                  key={priority}
                  variant={pipeline.selectedPriorities.includes(priority) ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const isSelected = pipeline.selectedPriorities.includes(priority);
                    if (isSelected) {
                      pipeline.setSelectedPriorities(pipeline.selectedPriorities.filter(p => p !== priority));
                    } else {
                      pipeline.setSelectedPriorities([...pipeline.selectedPriorities, priority]);
                    }
                  }}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                pipeline.setDealStatus('all');
                pipeline.setDocumentStatus('all');
                pipeline.setSelectedStages([]);
                pipeline.setSelectedPriorities([]);
                pipeline.setSearchTerm('');
              }}
            >
              Clear All Filters
            </Button>
            <Button
              className="w-full"
              onClick={pipeline.toggleFilterPanel}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
