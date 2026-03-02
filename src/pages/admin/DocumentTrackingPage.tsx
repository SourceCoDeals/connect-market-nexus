import { useState, useMemo, useCallback, useEffect } from 'react';
import { useShiftSelect } from '@/hooks/useShiftSelect';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSignature,
  Shield,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  AlertCircle,
  ExternalLink,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';

// ─── Types ───────────────────────────────────────────────────────────

type DocStatus =
  | 'not_started'
  | 'sent'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'redlined'
  | 'under_review';

interface DocumentRow {
  firmId: string;
  companyName: string;
  documentType: 'nda' | 'fee_agreement';
  status: DocStatus;
  sentAt: string | null;
  signedAt: string | null;
  signedByName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  // Deal request info (from first connection request)
  dealTitle: string | null;
  dealRequestId: string | null;
}

// ─── Data Hook ───────────────────────────────────────────────────────

function useDocumentTracking() {
  return useQuery<DocumentRow[]>({
    queryKey: ['admin-document-tracking'],
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Fetch all firms with their members and first connection request
      const { data: firms, error: firmsError } = await supabase
        .from('firm_agreements')
        .select(
          `
          id,
          primary_company_name,
          nda_status,
          nda_sent_at,
          nda_signed_at,
          nda_signed_by_name,
          nda_email_sent_at,
          fee_agreement_status,
          fee_agreement_sent_at,
          fee_agreement_signed_at,
          fee_agreement_signed_by_name,
          fee_agreement_email_sent_at,
          firm_members(
            id,
            is_primary_contact,
            lead_name,
            lead_email,
            user:profiles(
              id,
              first_name,
              last_name,
              email
            )
          )
        `,
        )
        .order('primary_company_name');

      if (firmsError) throw firmsError;
      if (!firms || firms.length === 0) return [];

      // 2. Fetch first connection request per firm for deal title
      const firmIds = firms.map((f: { id: string }) => f.id);
      const { data: requests } = await supabase
        .from('connection_requests')
        .select(
          `
          id,
          firm_id,
          listing:listings!connection_requests_listing_id_fkey(title)
        `,
        )
        .in('firm_id', firmIds)
        .order('created_at', { ascending: false });

      // Map firm_id to most recent deal request
      const firmDealMap: Record<string, { id: string; title: string }> = {};
      (requests || []).forEach(
        (r: { id: string; firm_id: string | null; listing: { title: string } | null }) => {
          if (r.firm_id && !firmDealMap[r.firm_id]) {
            firmDealMap[r.firm_id] = {
              id: r.id,
              title: r.listing?.title || 'Untitled Deal',
            };
          }
        },
      );

      // 3. Build document rows — one per document type per firm
      const rows: DocumentRow[] = [];

      type FirmRow = (typeof firms)[number];
      for (const firm of firms as FirmRow[]) {
        // Find primary contact
        const primaryMember = firm.firm_members?.find(
          (m: { is_primary_contact: boolean | null }) => m.is_primary_contact,
        );
        const anyMember = firm.firm_members?.[0];
        const member = primaryMember || anyMember;

        const contactName = member?.user
          ? `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim()
          : member?.lead_name || null;
        const contactEmail = member?.user?.email || member?.lead_email || null;

        const deal = firmDealMap[firm.id];

        // NDA row — only if sent or beyond
        const ndaStatus = firm.nda_status as DocStatus;
        if (ndaStatus && ndaStatus !== 'not_started') {
          rows.push({
            firmId: firm.id,
            companyName: firm.primary_company_name,
            documentType: 'nda',
            status: ndaStatus,
            sentAt: firm.nda_sent_at || firm.nda_email_sent_at,
            signedAt: firm.nda_signed_at,
            signedByName: firm.nda_signed_by_name,
            contactName,
            contactEmail,
            dealTitle: deal?.title || null,
            dealRequestId: deal?.id || null,
          });
        }

        // Fee Agreement row — only if sent or beyond
        const feeStatus = firm.fee_agreement_status as DocStatus;
        if (feeStatus && feeStatus !== 'not_started') {
          rows.push({
            firmId: firm.id,
            companyName: firm.primary_company_name,
            documentType: 'fee_agreement',
            status: feeStatus,
            sentAt: firm.fee_agreement_sent_at || firm.fee_agreement_email_sent_at,
            signedAt: firm.fee_agreement_signed_at,
            signedByName: firm.fee_agreement_signed_by_name,
            contactName,
            contactEmail,
            dealTitle: deal?.title || null,
            dealRequestId: deal?.id || null,
          });
        }
      }

      return rows;
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getStatusBadge(status: DocStatus) {
  switch (status) {
    case 'signed':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Signed
        </Badge>
      );
    case 'sent':
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
          <Send className="h-3 w-3" /> Sent
        </Badge>
      );
    case 'declined':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
          <XCircle className="h-3 w-3" /> Declined
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-200 gap-1">
          <Clock className="h-3 w-3" /> Expired
        </Badge>
      );
    case 'redlined':
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1">
          <AlertCircle className="h-3 w-3" /> Redlined
        </Badge>
      );
    case 'under_review':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
          <Clock className="h-3 w-3" /> Under Review
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
  }
}

// ─── Component ───────────────────────────────────────────────────────

type FilterStatus = 'all' | 'signed' | 'sent' | 'unsigned';
type SortField = 'company' | 'date' | 'status';

export default function DocumentTrackingPage() {
  const { data: documents = [], isLoading, error } = useDocumentTracking();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<'all' | 'nda' | 'fee_agreement'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Register AI Command Center context
  const { setPageContext } = useAICommandCenterContext();
  useEffect(() => {
    setPageContext({ page: 'document_tracking', entity_type: 'documents' });
  }, [setPageContext]);

  // Wire AI UI actions
  useAIUIActionHandler({
    table: 'documents',
    onSelectRows: (rowIds, mode) => {
      if (mode === 'replace') {
        setSelectedIds(new Set(rowIds));
      } else if (mode === 'add') {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rowIds.forEach((id) => next.add(id));
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rowIds.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
          return next;
        });
      }
    },
    onClearSelection: () => setSelectedIds(new Set()),
    onSortColumn: (field) => {
      const fieldMap: Record<string, SortField> = {
        company_name: 'company',
        date: 'date',
        status: 'status',
      };
      const mapped = fieldMap[field] || field;
      if (mapped === 'company' || mapped === 'date' || mapped === 'status')
        toggleSort(mapped as SortField);
    },
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredDocs = useMemo(() => {
    let result = [...documents];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.companyName.toLowerCase().includes(q) ||
          d.contactName?.toLowerCase().includes(q) ||
          d.contactEmail?.toLowerCase().includes(q) ||
          d.dealTitle?.toLowerCase().includes(q),
      );
    }

    // Filter by status
    if (filterStatus === 'signed') {
      result = result.filter((d) => d.status === 'signed');
    } else if (filterStatus === 'sent') {
      result = result.filter((d) => d.status === 'sent');
    } else if (filterStatus === 'unsigned') {
      result = result.filter((d) => d.status !== 'signed');
    }

    // Filter by doc type
    if (filterType !== 'all') {
      result = result.filter((d) => d.documentType === filterType);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'company') {
        cmp = a.companyName.localeCompare(b.companyName);
      } else if (sortField === 'date') {
        const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        cmp = dateB - dateA;
      } else if (sortField === 'status') {
        const order: Record<string, number> = {
          signed: 0,
          sent: 1,
          under_review: 2,
          redlined: 3,
          declined: 4,
          expired: 5,
        };
        cmp = (order[a.status] ?? 6) - (order[b.status] ?? 6);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [documents, searchQuery, filterStatus, filterType, sortField, sortAsc]);

  // Stats
  const totalSent = documents.length;
  const totalSigned = documents.filter((d) => d.status === 'signed').length;
  const totalPending = documents.filter((d) => d.status === 'sent').length;
  const totalOther = totalSent - totalSigned - totalPending;

  // Selection helpers
  const getRowKey = (doc: DocumentRow, idx: number) => `${doc.firmId}-${doc.documentType}-${idx}`;
  const allFilteredKeys = useMemo(
    () => filteredDocs.map((d, i) => getRowKey(d, i)),
    [filteredDocs],
  );
  const allSelected = filteredDocs.length > 0 && allFilteredKeys.every((k) => selectedIds.has(k));
  const someSelected = allFilteredKeys.some((k) => selectedIds.has(k));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredKeys.forEach((k) => next.delete(k));
      } else {
        allFilteredKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }, [allSelected, allFilteredKeys]);

  const orderedKeys = useMemo(() => allFilteredKeys, [allFilteredKeys]);
  const { handleToggle: toggleRow } = useShiftSelect(orderedKeys, selectedIds, setSelectedIds);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Document Tracking</h1>
        <p className="text-muted-foreground mt-1">
          Track all NDAs and Fee Agreements sent to buyers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={totalSent} />
        <StatCard label="Signed" value={totalSigned} color="emerald" />
        <StatCard label="Awaiting Signature" value={totalPending} color="amber" />
        <StatCard label="Declined / Expired / Other" value={totalOther} color="gray" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company, contact, or deal..."
            className="w-full text-sm border border-border rounded-lg pl-9 pr-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="text-sm border border-border rounded-lg px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="all">All Statuses</option>
            <option value="signed">Signed</option>
            <option value="sent">Awaiting Signature</option>
            <option value="unsigned">Not Signed</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'nda' | 'fee_agreement')}
            className="text-sm border border-border rounded-lg px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="all">All Types</option>
            <option value="nda">NDA</option>
            <option value="fee_agreement">Fee Agreement</option>
          </select>
        </div>
      </div>

      {/* Selection summary bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground hover:text-foreground underline text-xs"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {error ? (
        <div className="border border-border rounded-xl bg-card flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive">Failed to load documents</p>
          <p className="text-xs text-muted-foreground">Please try refreshing the page.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="border border-border rounded-xl bg-card flex flex-col items-center justify-center py-16">
          <FileSignature className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery || filterStatus !== 'all' || filterType !== 'all'
              ? 'Try adjusting your filters.'
              : 'Documents will appear here once agreements are sent to buyers.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button
                      onClick={() => toggleSort('company')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Company
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Document
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button
                      onClick={() => toggleSort('status')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Deal Request
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <button
                      onClick={() => toggleSort('date')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Sent
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Signed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map((doc, idx) => {
                  const rowKey = getRowKey(doc, idx);
                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-muted/30 transition-colors ${selectedIds.has(rowKey) ? 'bg-primary/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td
                        className="px-4 py-3 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(rowKey, !selectedIds.has(rowKey), e);
                        }}
                      >
                        <Checkbox
                          checked={selectedIds.has(rowKey)}
                          onCheckedChange={() => {
                            /* handled by td onClick for shift support */
                          }}
                          aria-label={`Select ${doc.companyName}`}
                        />
                      </td>
                      {/* Company */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{doc.companyName}</span>
                      </td>

                      {/* Document Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {doc.documentType === 'nda' ? (
                            <Shield className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <FileSignature className="h-3.5 w-3.5 text-purple-500" />
                          )}
                          <span>{doc.documentType === 'nda' ? 'NDA' : 'Fee Agreement'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">{getStatusBadge(doc.status)}</td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        {doc.contactName || doc.contactEmail ? (
                          <div>
                            {doc.contactName && (
                              <p className="text-foreground">{doc.contactName}</p>
                            )}
                            {doc.contactEmail && (
                              <p className="text-xs text-muted-foreground">{doc.contactEmail}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Deal Request */}
                      <td className="px-4 py-3">
                        {doc.dealTitle ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[200px]" title={doc.dealTitle}>
                              {doc.dealTitle}
                            </span>
                            {doc.dealRequestId && (
                              <Link
                                to={`/admin/marketplace/requests?highlight=${doc.dealRequestId}`}
                                className="text-primary hover:text-primary/80 shrink-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Sent Date */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {doc.sentAt ? (
                          <span title={format(new Date(doc.sentAt), 'MMM d, yyyy h:mm a')}>
                            {formatDistanceToNow(new Date(doc.sentAt), { addSuffix: true })}
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* Signed Date */}
                      <td className="px-4 py-3">
                        {doc.signedAt ? (
                          <div>
                            <p className="text-emerald-600 font-medium">
                              {format(new Date(doc.signedAt), 'MMM d, yyyy')}
                            </p>
                            {doc.signedByName && (
                              <p className="text-xs text-muted-foreground">{doc.signedByName}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            Showing {filteredDocs.length} of {documents.length} documents
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'emerald' | 'amber' | 'gray';
}) {
  const colorClasses =
    color === 'emerald'
      ? 'text-emerald-600'
      : color === 'amber'
        ? 'text-amber-600'
        : color === 'gray'
          ? 'text-gray-500'
          : 'text-foreground';

  return (
    <div className="border border-border rounded-xl bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses}`}>{value}</p>
    </div>
  );
}
