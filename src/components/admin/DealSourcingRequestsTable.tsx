import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Mail, ExternalLink } from 'lucide-react';
import { DealSourcingRequest } from '@/hooks/admin/use-deal-sourcing-requests';
import { DealSourcingDetailPanel } from './DealSourcingDetailPanel';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface DealSourcingRequestsTableProps {
  requests: DealSourcingRequest[];
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  reviewing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  contacted: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  scheduled_call: 'bg-green-500/10 text-green-500 border-green-500/20',
  converted_to_deal: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

const buyerTypeColors: Record<string, string> = {
  'Private Equity': 'bg-purple-500/10 text-purple-500',
  'Strategic/Corporate': 'bg-blue-500/10 text-blue-500',
  'Family Office': 'bg-green-500/10 text-green-500',
  'Independent Sponsor': 'bg-orange-500/10 text-orange-500',
  'Search Fund': 'bg-cyan-500/10 text-cyan-500',
  'Individual': 'bg-gray-500/10 text-gray-500',
};

export function DealSourcingRequestsTable({ requests }: DealSourcingRequestsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DealSourcingRequest | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No deal sourcing requests found
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>User</TableHead>
              <TableHead>Buyer Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <>
                <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={() => toggleRow(request.id)}>
                    {expandedRow === request.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell onClick={() => toggleRow(request.id)}>
                    <div className="flex flex-col">
                      <span className="font-medium">{request.user_name}</span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        {request.user_email}
                        {request.custom_message && (
                          <span title="Has custom message">
                            <Mail className="h-3 w-3 text-primary" />
                          </span>
                        )}
                      </span>
                      {request.user_company && (
                        <span className="text-xs text-muted-foreground">{request.user_company}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={() => toggleRow(request.id)}>
                    {request.buyer_type && (
                      <Badge variant="outline" className={buyerTypeColors[request.buyer_type] || 'bg-muted'}>
                        {request.buyer_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={() => toggleRow(request.id)}>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell onClick={() => toggleRow(request.id)}>
                    <Badge variant="outline" className={statusColors[request.status] || 'bg-muted'}>
                      {request.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={() => toggleRow(request.id)}>
                    {request.assigned_admin_name && (
                      <span className="text-sm">{request.assigned_admin_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(request);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedRow === request.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30">
                      <div className="space-y-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="font-medium mb-2">Business Categories</h4>
                            <div className="flex flex-wrap gap-1">
                              {request.business_categories?.map((cat) => (
                                <Badge key={cat} variant="secondary" className="text-xs">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Target Locations</h4>
                            <div className="flex flex-wrap gap-1">
                              {request.target_locations?.map((loc) => (
                                <Badge key={loc} variant="secondary" className="text-xs">
                                  {loc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        {request.revenue_min && request.revenue_max && (
                          <div>
                            <h4 className="font-medium mb-1">Revenue Range</h4>
                            <p className="text-sm text-muted-foreground">
                              ${request.revenue_min} - ${request.revenue_max}
                            </p>
                          </div>
                        )}
                        {request.investment_thesis && (
                          <div>
                            <h4 className="font-medium mb-1">Investment Thesis</h4>
                            <p className="text-sm text-muted-foreground">{request.investment_thesis}</p>
                          </div>
                        )}
                        {request.custom_message && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <h4 className="font-medium mb-1 flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              Custom Message
                            </h4>
                            <p className="text-sm">{request.custom_message}</p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
          {selectedRequest && (
            <DealSourcingDetailPanel
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
