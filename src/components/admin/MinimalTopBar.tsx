import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Settings, LayoutDashboard, List } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MinimalTopBarProps {
  onCreateDeal?: () => void;
  onManageStages?: () => void;
  defaultTab?: string;
}

export function MinimalTopBar({ onCreateDeal, onManageStages, defaultTab = "kanban" }: MinimalTopBarProps) {
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-border/20 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-medium text-foreground tracking-tight">Deals</h1>
        
        <Tabs defaultValue={defaultTab} className="h-8">
          <TabsList className="h-8 p-0.5 bg-muted/50">
            <TabsTrigger 
              value="kanban" 
              className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="h-3 w-3 mr-1.5" />
              Board
            </TabsTrigger>
            <TabsTrigger 
              value="list" 
              className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <List className="h-3 w-3 mr-1.5" />
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          onClick={onCreateDeal} 
          size="sm" 
          className="h-8 px-3 text-xs font-medium"
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Deal
        </Button>
        <Button 
          variant="outline" 
          onClick={onManageStages} 
          size="sm"
          className="h-8 px-3 text-xs"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}