import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TimeframeSelector } from '@/components/filters';
import { Loader2, BarChart3, ChevronDown, Sparkles } from 'lucide-react';

interface HeaderToolbarProps {
  totalLeads: number;
  unscoredCount: number;
  pushedTotal: number;
  isEnriching: boolean;
  isScoring: boolean;
  timeframe: string;
  onTimeframeChange: (value: string) => void;
  onBulkEnrich: (mode: 'unenriched' | 'all') => void;
  onScoreLeads: (mode: 'unscored' | 'all') => void;
}

export function HeaderToolbar({
  totalLeads,
  unscoredCount,
  pushedTotal,
  isEnriching,
  isScoring,
  timeframe,
  onTimeframeChange,
  onBulkEnrich,
  onScoreLeads,
}: HeaderToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Valuation Calculator Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalLeads} total &middot; {unscoredCount} unscored &middot; {pushedTotal} in All Deals
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Enrich All Pushed */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isEnriching}>
              {isEnriching ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Enrich
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onBulkEnrich('unenriched')}>
              Enrich Unenriched
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkEnrich('all')}>Re-enrich All</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Score */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isScoring}>
              {isScoring ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-1" />
              )}
              Score
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onScoreLeads('unscored')}>
              Score Unscored
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onScoreLeads('all')}>Recalculate All</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Timeframe selector */}
        <TimeframeSelector value={timeframe} onChange={onTimeframeChange} compact />
      </div>
    </div>
  );
}
