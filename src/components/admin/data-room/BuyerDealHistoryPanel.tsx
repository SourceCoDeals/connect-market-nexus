/**
 * BuyerDealHistoryPanel: Shows all deals a buyer has received memos for,
 * data room access, and pipeline deals. Embedded in buyer detail page.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, Send, Loader2, Shield, CheckCircle, XCircle } from 'lucide-react';
import { useBuyerDealHistory } from '@/hooks/admin/data-room/use-data-room';

interface BuyerDealHistoryPanelProps {
  buyerId: string;
}

export function BuyerDealHistoryPanel({ buyerId }: BuyerDealHistoryPanelProps) {
  const { data: history = [], isLoading } = useBuyerDealHistory(buyerId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Deal History & Materials
          <Badge variant="secondary" className="ml-1">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {history.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2" />
            No deal interactions recorded
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Teaser</TableHead>
                <TableHead className="text-center">Full Memo</TableHead>
                <TableHead className="text-center">Data Room</TableHead>
                <TableHead>Memos Sent</TableHead>
                <TableHead>Pipeline Stage</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item: any) => (
                <TableRow key={item.deal_id}>
                  <TableCell className="font-medium text-sm">
                    {item.deal_title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.deal_category}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.has_teaser_access ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.has_full_memo_access ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.has_data_room_access ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.memos_sent > 0 ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Send className="h-3 w-3" />
                        {item.memos_sent}
                        {item.last_memo_sent_at && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({new Date(item.last_memo_sent_at).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.pipeline_stage ? (
                      <Badge variant="outline" className="text-xs">{item.pipeline_stage}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.last_memo_sent_at
                      ? new Date(item.last_memo_sent_at).toLocaleDateString()
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
