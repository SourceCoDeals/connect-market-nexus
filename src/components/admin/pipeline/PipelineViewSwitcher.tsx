import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Plus } from 'lucide-react';
import { usePipelineViews } from '@/hooks/admin/use-pipeline-views';

interface PipelineViewSwitcherProps {
  currentViewId?: string;
  onViewChange: (viewId: string) => void;
  onCreateView: () => void;
}

export function PipelineViewSwitcher({ currentViewId, onViewChange, onCreateView }: PipelineViewSwitcherProps) {
  const { data: views = [], isLoading } = usePipelineViews();

  const defaultView = views.find(v => v.is_default);
  const selectedViewId = currentViewId || defaultView?.id || views[0]?.id;

  if (isLoading || views.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedViewId} onValueChange={onViewChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select view" />
        </SelectTrigger>
        <SelectContent>
          {views.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.name}
              {view.is_default && ' (Default)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={onCreateView}
      >
        <Plus className="h-4 w-4 mr-2" />
        New View
      </Button>
    </div>
  );
}