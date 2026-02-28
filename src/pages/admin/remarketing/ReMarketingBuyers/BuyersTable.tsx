import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import BuyerTableRow from "./BuyerTableRow";
import { PAGE_SIZE } from "./constants";
import type { BuyerTab } from "./constants";
import { useColumnResize } from "@/hooks/useColumnResize";
import { ResizeHandle } from "@/components/ui/ResizeHandle";

interface BuyersTableProps {
  activeTab: BuyerTab;
  buyersLoading: boolean;
  filteredBuyers: any[];
  pagedBuyers: any[];
  currentPage: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
  totalPages: number;
  selectedIds: Set<string>;
  buyers: any[] | undefined;
  platformCountsByFirm: Map<string, number>;
  buyerIdsWithTranscripts: Set<string> | undefined;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  toggleSelect: (id: string, checked: boolean, event?: React.MouseEvent | React.KeyboardEvent) => void;
  toggleSelectAll: () => void;
  handleSort: (column: string) => void;
  handleEnrichBuyer: (e: React.MouseEvent, buyerId: string) => void;
  deleteMutation: { mutate: (id: string) => void };
}

const SortIcon = ({ column, sortColumn, sortDirection }: { column: string; sortColumn: string; sortDirection: "asc" | "desc" }) => {
  if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
  return sortDirection === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
    : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
};

const DEFAULT_WIDTHS: Record<string, number> = {
  checkbox: 40,
  rowNum: 48,
  companyName: 260,
  peFirm: 180,
  universe: 140,
  description: 200,
  type: 140,
  platforms: 110,
  marketplace: 70,
  feeAgmt: 70,
  nda: 60,
  intel: 130,
  actions: 50,
};

const BuyersTable = ({
  activeTab,
  buyersLoading,
  filteredBuyers,
  pagedBuyers,
  currentPage,
  setCurrentPage,
  totalPages,
  selectedIds,
  buyers,
  platformCountsByFirm,
  buyerIdsWithTranscripts,
  sortColumn,
  sortDirection,
  toggleSelect,
  toggleSelectAll,
  handleSort,
  handleEnrichBuyer,
  deleteMutation,
}: BuyersTableProps) => {
  const { columnWidths, startResize } = useColumnResize({ defaultWidths: DEFAULT_WIDTHS });

  return (
    <Card>
      <CardContent className="p-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: columnWidths.checkbox }}>
                <Checkbox
                  checked={filteredBuyers.length > 0 && selectedIds.size === filteredBuyers.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-normal relative" style={{ width: columnWidths.rowNum }}>
                #
                <ResizeHandle onMouseDown={(e) => startResize('rowNum', e)} />
              </TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-muted/50 relative" style={{ width: columnWidths.companyName }} onClick={() => handleSort('company_name')}>
                <span className="flex items-center">
                  {activeTab === 'pe_firm' ? 'Firm Name' : 'Platform / Buyer'}
                  <SortIcon column="company_name" sortColumn={sortColumn} sortDirection={sortDirection} />
                </span>
                <ResizeHandle onMouseDown={(e) => startResize('companyName', e)} />
              </TableHead>
              {activeTab === 'pe_firm' ? (
                <>
                  <TableHead className="relative" style={{ width: columnWidths.type }}>
                    Type
                    <ResizeHandle onMouseDown={(e) => startResize('type', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.platforms }}>
                    Platforms
                    <ResizeHandle onMouseDown={(e) => startResize('platforms', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.feeAgmt }}>
                    Fee Agmt
                    <ResizeHandle onMouseDown={(e) => startResize('feeAgmt', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.nda }}>
                    NDA
                    <ResizeHandle onMouseDown={(e) => startResize('nda', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.marketplace }}>
                    Mktpl.
                    <ResizeHandle onMouseDown={(e) => startResize('marketplace', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.intel }}>
                    Intel
                    <ResizeHandle onMouseDown={(e) => startResize('intel', e)} />
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50 relative" style={{ width: columnWidths.peFirm }} onClick={() => handleSort('pe_firm_name')}>
                    <span className="flex items-center">PE Firm <SortIcon column="pe_firm_name" sortColumn={sortColumn} sortDirection={sortDirection} /></span>
                    <ResizeHandle onMouseDown={(e) => startResize('peFirm', e)} />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:bg-muted/50 relative" style={{ width: columnWidths.universe }} onClick={() => handleSort('universe')}>
                    <span className="flex items-center">Universe <SortIcon column="universe" sortColumn={sortColumn} sortDirection={sortDirection} /></span>
                    <ResizeHandle onMouseDown={(e) => startResize('universe', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.description }}>
                    Description
                    <ResizeHandle onMouseDown={(e) => startResize('description', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.marketplace }}>
                    Mktpl.
                    <ResizeHandle onMouseDown={(e) => startResize('marketplace', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.feeAgmt }}>
                    Fee Agmt
                    <ResizeHandle onMouseDown={(e) => startResize('feeAgmt', e)} />
                  </TableHead>
                  <TableHead className="text-center relative" style={{ width: columnWidths.nda }}>
                    NDA
                    <ResizeHandle onMouseDown={(e) => startResize('nda', e)} />
                  </TableHead>
                  <TableHead className="relative" style={{ width: columnWidths.intel }}>
                    Intel
                    <ResizeHandle onMouseDown={(e) => startResize('intel', e)} />
                  </TableHead>
                </>
              )}
              <TableHead style={{ width: columnWidths.actions }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buyersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredBuyers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No buyers found</p>
                  <p className="text-sm">Add buyers manually or import from CSV</p>
                </TableCell>
              </TableRow>
            ) : (
              pagedBuyers.map((buyer: any, pageIdx: number) => {
                const globalIdx = (currentPage - 1) * PAGE_SIZE + pageIdx + 1;
                return (
                  <BuyerTableRow
                    key={buyer.id}
                    buyer={buyer}
                    globalIdx={globalIdx}
                    activeTab={activeTab}
                    selectedIds={selectedIds}
                    buyers={buyers}
                    platformCountsByFirm={platformCountsByFirm}
                    buyerIdsWithTranscripts={buyerIdsWithTranscripts}
                    toggleSelect={toggleSelect}
                    handleEnrichBuyer={handleEnrichBuyer}
                    deleteMutation={deleteMutation}
                  />
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {!buyersLoading && filteredBuyers.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBuyers.length)} of {filteredBuyers.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >«</Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p: number) => p - 1)}
              >‹ Prev</Button>
              <span className="px-3 font-medium text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p: number) => p + 1)}
              >Next ›</Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >»</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BuyersTable;
