import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortColumn } from './types';

interface LeadsTableHeaderProps {
  activeTab: string;
  colWidths: Record<string, number>;
  sortColumn: SortColumn;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onSort: (col: SortColumn) => void;
  onStartResize: (col: string, e: React.MouseEvent) => void;
}

function SortHeaderButton({
  column,
  sortColumn,
  onSort,
  children,
}: {
  column: SortColumn;
  sortColumn: SortColumn;
  onSort: (col: SortColumn) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => onSort(column)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          'h-3 w-3',
          sortColumn === column ? 'text-foreground' : 'text-muted-foreground/50',
        )}
      />
    </button>
  );
}

export function LeadsTableHeader({
  activeTab,
  colWidths,
  sortColumn,
  allSelected,
  onToggleSelectAll,
  onSort,
  onStartResize,
}: LeadsTableHeaderProps) {
  const ResizeHandle = ({ col }: { col: string }) => (
    <div
      onMouseDown={(e) => onStartResize(col, e)}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
    />
  );

  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[40px]">
          <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
        </TableHead>
        <TableHead className="w-[40px] text-center text-muted-foreground">#</TableHead>
        {(['company', 'description'] as const).map((col) => (
          <TableHead
            key={col}
            className="relative overflow-visible"
            style={{ width: colWidths[col] }}
          >
            {col === 'company' ? (
              <SortHeaderButton column="display_name" sortColumn={sortColumn} onSort={onSort}>
                Company
              </SortHeaderButton>
            ) : (
              'Description'
            )}
            <ResizeHandle col={col} />
          </TableHead>
        ))}
        {activeTab === 'all' && (
          <TableHead className="relative overflow-visible" style={{ width: colWidths.calculator }}>
            Calculator
            <ResizeHandle col="calculator" />
          </TableHead>
        )}
        {(
          [
            'industry',
            'location',
            'owner',
            'revenue',
            'ebitda',
            'valuation',
            'exit',
            'intros',
            'quality',
            'score',
            'added',
            'status',
            'priority',
          ] as const
        ).map((col) => (
          <TableHead
            key={col}
            className="relative overflow-visible"
            style={{
              width: colWidths[col],
              textAlign: ['revenue', 'ebitda', 'valuation'].includes(col)
                ? 'right'
                : ['intros', 'priority'].includes(col)
                  ? 'center'
                  : undefined,
            }}
          >
            {col === 'industry' && (
              <SortHeaderButton column="industry" sortColumn={sortColumn} onSort={onSort}>
                Industry
              </SortHeaderButton>
            )}
            {col === 'location' && (
              <SortHeaderButton column="location" sortColumn={sortColumn} onSort={onSort}>
                Location
              </SortHeaderButton>
            )}
            {col === 'owner' && (
              <SortHeaderButton column="owner" sortColumn={sortColumn} onSort={onSort}>
                Deal Owner
              </SortHeaderButton>
            )}
            {col === 'revenue' && (
              <SortHeaderButton column="revenue" sortColumn={sortColumn} onSort={onSort}>
                Revenue
              </SortHeaderButton>
            )}
            {col === 'ebitda' && (
              <SortHeaderButton column="ebitda" sortColumn={sortColumn} onSort={onSort}>
                EBITDA
              </SortHeaderButton>
            )}
            {col === 'valuation' && (
              <SortHeaderButton column="valuation" sortColumn={sortColumn} onSort={onSort}>
                Valuation
              </SortHeaderButton>
            )}
            {col === 'exit' && (
              <SortHeaderButton column="exit_timing" sortColumn={sortColumn} onSort={onSort}>
                Exit
              </SortHeaderButton>
            )}
            {col === 'intros' && (
              <SortHeaderButton column="intros" sortColumn={sortColumn} onSort={onSort}>
                Intros
              </SortHeaderButton>
            )}
            {col === 'quality' && (
              <SortHeaderButton column="quality" sortColumn={sortColumn} onSort={onSort}>
                Quality
              </SortHeaderButton>
            )}
            {col === 'score' && (
              <SortHeaderButton column="score" sortColumn={sortColumn} onSort={onSort}>
                Score
              </SortHeaderButton>
            )}
            {col === 'added' && (
              <SortHeaderButton column="created_at" sortColumn={sortColumn} onSort={onSort}>
                Added
              </SortHeaderButton>
            )}
            {col === 'status' && (
              <SortHeaderButton column="pushed" sortColumn={sortColumn} onSort={onSort}>
                Status
              </SortHeaderButton>
            )}
            {col === 'priority' && (
              <SortHeaderButton column="priority" sortColumn={sortColumn} onSort={onSort}>
                Priority
              </SortHeaderButton>
            )}
            <ResizeHandle col={col} />
          </TableHead>
        ))}
        <TableHead className="w-[50px]"></TableHead>
      </TableRow>
    </TableHeader>
  );
}
