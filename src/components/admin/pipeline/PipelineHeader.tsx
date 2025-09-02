
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  MoreVertical,
  Plus,
  Kanban,
  List,
  Table,
  Menu,
  X,
} from 'lucide-react';
import { usePipelineCore, ViewMode } from '@/hooks/admin/use-pipeline-core';
import { PipelineMode } from './PipelineShell';

interface PipelineHeaderProps {
  pipeline: ReturnType<typeof usePipelineCore>;
  pipelineMode: PipelineMode;
  setPipelineMode: (mode: PipelineMode) => void;
}

export function PipelineHeader({ pipeline, pipelineMode, setPipelineMode }: PipelineHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const viewIcons = {
    kanban: Kanban,
    list: List,
    table: Table,
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between p-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Pipeline</h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {pipelineMode === 'deals' ? `${pipeline.deals.length} deals` : 'Connection Requests'}
            </Badge>
          </div>

          {/* Pipeline Mode Toggle */}
          <div className="hidden md:flex border rounded-lg p-1">
            <button
              onClick={() => setPipelineMode('deals')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                pipelineMode === 'deals'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Deals
            </button>
            <button
              onClick={() => setPipelineMode('connection-requests')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                pipelineMode === 'connection-requests'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connections
            </button>
          </div>

          {/* Desktop Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              className="pl-9 w-64"
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* View Mode Selector */}
          <Select value={pipeline.viewMode} onValueChange={(value) => pipeline.setViewMode(value as ViewMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">
                <div className="flex items-center gap-2">
                  <Kanban className="h-4 w-4" />
                  Kanban
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List
                </div>
              </SelectItem>
              <SelectItem value="table">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  Table
                </div>
              </SelectItem>
            </SelectContent>
          </Select>


          <Button
            variant="outline"
            size="sm"
            onClick={pipeline.toggleFilterPanel}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>

          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {pipelineMode === 'deals' ? 'New Deal' : 'New Request'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Pipeline</DropdownMenuItem>
              <DropdownMenuItem>Import Deals</DropdownMenuItem>
              <DropdownMenuItem>Pipeline Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-4">
          {/* Mobile Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search deals..."
              className="pl-9"
              value={pipeline.searchQuery}
              onChange={(e) => pipeline.setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mobile View Mode */}
          <div className="flex gap-2">
            {Object.entries(viewIcons).map(([mode, Icon]) => (
              <Button
                key={mode}
                variant={pipeline.viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => pipeline.setViewMode(mode as ViewMode)}
                className="flex-1"
              >
                <Icon className="h-4 w-4 mr-2" />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>

          {/* Mobile Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={pipeline.toggleFilterPanel}
              className="flex-1"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          <Button size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {pipelineMode === 'deals' ? 'New Deal' : 'New Request'}
          </Button>
        </div>
      )}
    </div>
  );
}
