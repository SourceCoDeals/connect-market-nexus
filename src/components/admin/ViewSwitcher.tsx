import { Button } from "@/components/ui/button";
import { Table, Grid3x3 } from "lucide-react";

interface ViewSwitcherProps {
  viewMode: 'table' | 'grid';
  onViewChange: (mode: 'table' | 'grid') => void;
}

export function ViewSwitcher({ viewMode, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-lg p-1">
      <Button
        variant={viewMode === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('table')}
        className="h-8 px-3"
      >
        <Table className="h-4 w-4 mr-2" />
        Table View
      </Button>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="h-8 px-3"
      >
        <Grid3x3 className="h-4 w-4 mr-2" />
        Grid View
      </Button>
    </div>
  );
}