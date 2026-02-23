import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Calculator } from 'lucide-react';
import type { ValuationLead, SortColumn, AdminProfileMap } from './types';
import { LeadsTableHeader } from './LeadsTableHeader';
import { LeadTableRow } from './LeadTableRow';

interface LeadsTableProps {
  paginatedLeads: ValuationLead[];
  activeTab: string;
  colWidths: Record<string, number>;
  sortColumn: SortColumn;
  safePage: number;
  pageSize: number;
  selectedIds: Set<string>;
  allSelected: boolean;
  adminProfiles: AdminProfileMap | undefined;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onSort: (col: SortColumn) => void;
  onStartResize: (col: string, e: React.MouseEvent) => void;
  onRowClick: (lead: ValuationLead) => void;
  onAssignOwner: (lead: ValuationLead, ownerId: string | null) => void;
  onPushToAllDeals: (ids: string[]) => void;
  onPushAndEnrich: (ids: string[]) => void;
  onReEnrich: (ids: string[]) => void;
  refetch: () => void;
}

export function LeadsTable({
  paginatedLeads,
  activeTab,
  colWidths,
  sortColumn,
  safePage,
  pageSize,
  selectedIds,
  allSelected,
  adminProfiles,
  onToggleSelectAll,
  onToggleSelect,
  onSort,
  onStartResize,
  onRowClick,
  onAssignOwner,
  onPushToAllDeals,
  onPushAndEnrich,
  onReEnrich,
  refetch,
}: LeadsTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: colWidths.company }} />
              <col style={{ width: colWidths.description }} />
              {activeTab === 'all' && <col style={{ width: colWidths.calculator }} />}
              <col style={{ width: colWidths.industry }} />
              <col style={{ width: colWidths.location }} />
              <col style={{ width: colWidths.owner }} />
              <col style={{ width: colWidths.revenue }} />
              <col style={{ width: colWidths.ebitda }} />
              <col style={{ width: colWidths.valuation }} />
              <col style={{ width: colWidths.exit }} />
              <col style={{ width: colWidths.intros }} />
              <col style={{ width: colWidths.quality }} />
              <col style={{ width: colWidths.score }} />
              <col style={{ width: colWidths.added }} />
              <col style={{ width: colWidths.status }} />
              <col style={{ width: 50 }} />
            </colgroup>
            <LeadsTableHeader
              activeTab={activeTab}
              colWidths={colWidths}
              sortColumn={sortColumn}
              allSelected={allSelected}
              onToggleSelectAll={onToggleSelectAll}
              onSort={onSort}
              onStartResize={onStartResize}
            />
            <TableBody>
              {paginatedLeads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeTab === 'all' ? 17 : 16}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">No valuation calculator leads yet</p>
                    <p className="text-sm mt-1">
                      Leads will appear here when submitted through SourceCo calculators.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLeads.map((lead, idx) => (
                  <LeadTableRow
                    key={lead.id}
                    lead={lead}
                    idx={idx}
                    safePage={safePage}
                    pageSize={pageSize}
                    activeTab={activeTab}
                    isSelected={selectedIds.has(lead.id)}
                    adminProfiles={adminProfiles}
                    onToggleSelect={onToggleSelect}
                    onRowClick={onRowClick}
                    onAssignOwner={onAssignOwner}
                    onPushToAllDeals={onPushToAllDeals}
                    onPushAndEnrich={onPushAndEnrich}
                    onReEnrich={onReEnrich}
                    refetch={refetch}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
