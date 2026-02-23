import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { BarChart3, Users, FolderOpen, TrendingUp, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { useBuyerEngagementHistory, type EngagementSource } from "@/hooks/admin/use-buyer-engagement-history";

interface BuyerEngagementTabProps {
  buyerId: string;
  emailDomain: string | null | undefined;
  marketplaceFirmId: string | null | undefined;
}

const SOURCE_BADGE_MAP: Record<EngagementSource, { label: string; className: string }> = {
  marketplace: { label: "Marketplace", className: "bg-green-50 text-green-700 border-green-200" },
  remarketing: { label: "Remarketing", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pipeline: { label: "Pipeline", className: "bg-blue-50 text-blue-700 border-blue-200" },
  document: { label: "Document", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_BADGE_MAP: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  interested: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  passed: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

type FilterType = 'all' | EngagementSource;

export function BuyerEngagementTab({ buyerId, emailDomain, marketplaceFirmId }: BuyerEngagementTabProps) {
  const { data, isLoading } = useBuyerEngagementHistory(buyerId, emailDomain, marketplaceFirmId);
  const [filter, setFilter] = useState<FilterType>('all');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { items = [], summary } = data || { items: [], summary: { totalDealsShown: 0, interestedCount: 0, pipelineActiveCount: 0, documentsSharedCount: 0 } };
  const filteredItems = filter === 'all' ? items : items.filter(i => i.source === filter);

  const filterButtons: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: items.length },
    { key: 'marketplace', label: 'Marketplace', count: items.filter(i => i.source === 'marketplace').length },
    { key: 'remarketing', label: 'Remarketing', count: items.filter(i => i.source === 'remarketing').length },
    { key: 'pipeline', label: 'Pipeline', count: items.filter(i => i.source === 'pipeline').length },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<BarChart3 className="h-4 w-4 text-indigo-600" />}
          label="Deals Shown"
          value={summary?.totalDealsShown || 0}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          label="Interested"
          value={summary?.interestedCount || 0}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4 text-blue-600" />}
          label="Pipeline Active"
          value={summary?.pipelineActiveCount || 0}
        />
        <SummaryCard
          icon={<FolderOpen className="h-4 w-4 text-amber-600" />}
          label="Docs Shared"
          value={summary?.documentsSharedCount || 0}
        />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filterButtons.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label} {f.count !== undefined && f.count > 0 && `(${f.count})`}
          </Button>
        ))}
      </div>

      {/* Timeline Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Engagement Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No engagement history found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Deal / Listing</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.listingId ? (
                        <Link
                          to={`/admin/remarketing/matching/${item.listingId}`}
                          className="hover:underline text-primary"
                        >
                          {item.dealTitle}
                        </Link>
                      ) : item.dealId ? (
                        <Link
                          to={`/admin/deals/${item.dealId}`}
                          className="hover:underline text-primary"
                        >
                          {item.dealTitle}
                        </Link>
                      ) : (
                        item.dealTitle
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-1.5 py-0 ${SOURCE_BADGE_MAP[item.source].className}`}
                      >
                        {SOURCE_BADGE_MAP[item.source].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE_MAP[item.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {item.status}
                      </Badge>
                      {item.stage && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({item.stage})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.score != null ? (
                        <span className="font-semibold">{Math.round(item.score)}</span>
                      ) : '—'}
                      {item.tier && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {item.tier}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.contactName || item.contactEmail || '—'}
                    </TableCell>
                    <TableCell>
                      {item.documentsShared ? (
                        <div className="flex gap-1">
                          {item.documentsShared.teaser && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">T</Badge>
                          )}
                          {item.documentsShared.memo && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">M</Badge>
                          )}
                          {item.documentsShared.dataRoom && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">DR</Badge>
                          )}
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="p-2 rounded-md bg-muted">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
