import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, X } from 'lucide-react';

interface SourceFilterProps {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

const sourceOptions = [
  { value: 'marketplace', label: 'Marketplace', color: 'bg-gray-100 text-gray-700' },
  { value: 'webflow', label: 'Webflow', color: 'bg-blue-100 text-blue-700' },
  { value: 'manual', label: 'Manual', color: 'bg-purple-100 text-purple-700' },
  { value: 'import', label: 'Import', color: 'bg-orange-100 text-orange-700' },
  { value: 'api', label: 'API', color: 'bg-green-100 text-green-700' },
];

export const SourceFilter = ({ selectedSources, onSourcesChange }: SourceFilterProps) => {
  const handleSourceToggle = (source: string) => {
    const isSelected = selectedSources.includes(source);
    if (isSelected) {
      onSourcesChange(selectedSources.filter(s => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const handleClearAll = () => {
    onSourcesChange([]);
  };

  const activeFilters = selectedSources.length;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Source
            {activeFilters > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {activeFilters}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {sourceOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedSources.includes(option.value)}
              onCheckedChange={() => handleSourceToggle(option.value)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${option.color.replace('text-', 'bg-').replace('bg-', 'bg-').split(' ')[0]}`} />
                {option.label}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active filters display */}
      {selectedSources.length > 0 && (
        <div className="flex items-center gap-1">
          {selectedSources.map((source) => {
            const option = sourceOptions.find(opt => opt.value === source);
            return option ? (
              <Badge 
                key={source} 
                variant="secondary" 
                className={`text-xs ${option.color} cursor-pointer hover:opacity-80`}
                onClick={() => handleSourceToggle(source)}
              >
                {option.label}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ) : null;
          })}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};