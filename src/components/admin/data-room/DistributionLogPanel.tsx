/**
 * DistributionLogPanel: Shows all memo sends across channels
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Send, Mail, ClipboardList, Monitor, Loader2 } from 'lucide-react';
import { useDistributionLog, DistributionLogEntry } from '@/hooks/admin/data-room/use-data-room';

interface DistributionLogPanelProps {
  dealId: string;
}

const CHANNEL_ICONS: Record<string, any> = {
  platform: Monitor,
  email: Mail,
  manual_log: ClipboardList,
};

const CHANNEL_LABELS: Record<string, string> = {
  platform: 'Platform',
  email: 'Email',
  manual_log: 'Manual Log',
};

const MEMO_TYPE_LABELS: Record<string, string> = {
  anonymous_teaser: 'Teaser',
  full_memo: 'Full Memo',
};

export function DistributionLogPanel({ dealId }: DistributionLogPanelProps) {
  const { data: logs = [], isLoading } = useDistributionLog(dealId);

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
          <Send className="h-4 w-4" />
          Distribution Log
          <Badge variant="secondary" className="ml-1">{logs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Send className="mx-auto h-8 w-8 mb-2" />
            No memos have been distributed yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>PE Firm</TableHead>
                <TableHead>Memo Type</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Sent By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => {
                const ChannelIcon = CHANNEL_ICONS[log.channel] || Send;
                return (
                  <TableRow key={log.log_id}>
                    <TableCell className="font-medium text-sm">
                      {log.buyer_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.buyer_company}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {MEMO_TYPE_LABELS[log.memo_type] || log.memo_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <ChannelIcon className="h-3.5 w-3.5" />
                        {CHANNEL_LABELS[log.channel] || log.channel}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.sent_by_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.sent_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.email_address || log.notes || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
