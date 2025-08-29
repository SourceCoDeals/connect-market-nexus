import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, LayoutDashboard, List } from 'lucide-react';

interface MinimalTopBarProps {
  currentView: 'kanban' | 'list';
  onViewChange: (view: 'kanban' | 'list') => void;
  onCreateDeal: () => void;
  onManageStages: () => void;
  dealCount: number;
  totalValue: string;
}

export function MinimalTopBar({ 
  currentView, 
  onViewChange, 
  onCreateDeal, 
  onManageStages,
  dealCount,
  totalValue 
}: MinimalTopBarProps) {
  return (
    <div className="h-12 px-4 flex items-center justify-between border-b border-border/20 bg-background/95 backdrop-blur-sm">
      {/* Left: Title and View Toggle */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-medium text-foreground">Deals</h1>
        
        {/* View Toggle - Apple style */}
        <div className="flex bg-muted/30 rounded-lg p-1 border border-border/40">
          <button
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
              currentView === 'kanban' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
              currentView === 'list' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Right: Stats and Actions */}
      <div className="flex items-center gap-4">
        {/* Subtle stats */}
        <div className="text-xs text-muted-foreground font-medium">
          {dealCount} deals • {totalValue}
        </div>
        
        {/* Action buttons - Stripe style */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onManageStages}
            className="h-8 px-3 text-xs border-border/40 hover:border-border"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
          <Button 
            size="sm"
            onClick={onCreateDeal}
            className="h-8 px-3 text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New deal
          </Button>
        </div>
      </div>
    </div>
  );
}