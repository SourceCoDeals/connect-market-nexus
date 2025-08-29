import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Plus, 
  Settings, 
  Filter, 
  LayoutGrid,
  List,
  Table
} from 'lucide-react';
import { ViewMode, PipelineFilters } from '@/hooks/admin/use-pipeline-state';
import { PipelineFilterPanel } from './PipelineFilterPanel';
import { cn } from '@/lib/utils';

interface PipelineHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
  onCreateDeal: () => void;
  onManageStages: () => void;
}

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange,
  onCreateDeal,
  onManageStages
}) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const viewModeIcons = {
    kanban: LayoutGrid,
    list: List,
    table: Table
  };

  return (
    <>
      <header className="h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50 px-4 sm:px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 h-9 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={cn(
              "h-9 px-3",
              isFilterPanelOpen && "bg-accent"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Filters</span>
          </Button>
        </div>

        {/* Center Section - View Mode */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
          {Object.entries(viewModeIcons).map(([mode, Icon]) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange(mode as ViewMode)}
              className={cn(
                "h-8 w-8 p-0",
                viewMode === mode && "bg-background shadow-sm"
              )}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onManageStages}
            className="h-9 px-3 hidden sm:flex"
          >
            <Settings className="h-4 w-4" />
            <span className="ml-2">Stages</span>
          </Button>

          <Button
            onClick={onCreateDeal}
            size="sm"
            className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-2">Deal</span>
          </Button>
        </div>
      </header>

      {/* Filter Panel */}
      <PipelineFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </>
  );
};