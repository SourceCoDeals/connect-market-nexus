import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface LeadsPaginationProps {
  filteredCount: number;
  totalLeads: number;
  safePage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function LeadsPagination({
  filteredCount,
  totalLeads,
  safePage,
  totalPages,
  pageSize,
  onPageChange,
}: LeadsPaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {filteredCount > 0 ? (safePage - 1) * pageSize + 1 : 0}&ndash;
        {Math.min(safePage * pageSize, filteredCount)} of {filteredCount} leads
        {filteredCount !== totalLeads && ` (filtered from ${totalLeads})`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-3 tabular-nums flex items-center gap-1">
          Page
          <input
            type="number"
            min={1}
            max={totalPages}
            value={safePage}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= totalPages) onPageChange(val);
            }}
            className="w-12 h-7 text-center text-sm border border-input rounded-md bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
