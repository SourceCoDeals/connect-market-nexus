/**
 * AuditLogPanel: Complete audit trail for data room events
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList } from 'lucide-react';
import { useDataRoomAuditLog, AuditLogEntry } from '@/hooks/admin/data-room/use-data-room';

interface AuditLogPanelProps {
  dealId: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  view_document: { label: 'Viewed', color: 'bg-blue-100 text-blue-800' },
  download_document: { label: 'Downloaded', color: 'bg-indigo-100 text-indigo-800' },
  grant_teaser: { label: 'Granted Teaser', color: 'bg-green-100 text-green-800' },
  grant_full_memo: { label: 'Granted Full Memo', color: 'bg-green-100 text-green-800' },
  grant_data_room: { label: 'Granted Data Room', color: 'bg-green-100 text-green-800' },
  revoke_teaser: { label: 'Revoked Teaser', color: 'bg-red-100 text-red-800' },
  revoke_full_memo: { label: 'Revoked Full Memo', color: 'bg-red-100 text-red-800' },
  revoke_data_room: { label: 'Revoked Data Room', color: 'bg-red-100 text-red-800' },
  upload_document: { label: 'Uploaded', color: 'bg-purple-100 text-purple-800' },
  delete_document: { label: 'Deleted', color: 'bg-red-100 text-red-800' },
  fee_agreement_override: { label: 'Fee Override', color: 'bg-amber-100 text-amber-800' },
  generate_memo: { label: 'Generated Memo', color: 'bg-cyan-100 text-cyan-800' },
  edit_memo: { label: 'Edited Memo', color: 'bg-slate-100 text-slate-800' },
  publish_memo: { label: 'Published Memo', color: 'bg-green-100 text-green-800' },
  send_memo_email: { label: 'Sent Email', color: 'bg-violet-100 text-violet-800' },
  manual_log_send: { label: 'Manual Log', color: 'bg-orange-100 text-orange-800' },
  bulk_grant: { label: 'Bulk Grant', color: 'bg-green-100 text-green-800' },
  bulk_revoke: { label: 'Bulk Revoke', color: 'bg-red-100 text-red-800' },
  view_data_room: { label: 'Viewed Room', color: 'bg-blue-100 text-blue-800' },
};

export function AuditLogPanel({ dealId }: AuditLogPanelProps) {
  const { data: logs = [], isLoading } = useDataRoomAuditLog(dealId);

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
          <ClipboardList className="h-4 w-4" />
          Audit Log
          <Badge variant="secondary" className="ml-1">{logs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-8 w-8 mb-2" />
            No activity recorded yet
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map(log => {
              const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' };
              const metadata = log.metadata || {};

              return (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="flex-shrink-0 pt-0.5">
                    <Badge className={actionInfo.color} variant="secondary">
                      {actionInfo.label}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {formatAuditMessage(log)}
                    </p>
                    {log.ip_address && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        IP: {log.ip_address}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatAuditMessage(log: AuditLogEntry): string {
  const m = log.metadata || {};

  switch (log.action) {
    case 'upload_document':
      return `Uploaded "${m.file_name}" to ${m.folder_name} (${m.document_category})`;
    case 'delete_document':
      return `Deleted document`;
    case 'view_document':
      return `Viewed "${m.file_name}" (${m.document_category})${m.is_admin ? ' [admin]' : ''}`;
    case 'download_document':
      return `Downloaded "${m.file_name}" (${m.document_category})${m.is_admin ? ' [admin]' : ''}`;
    case 'grant_teaser':
    case 'grant_full_memo':
    case 'grant_data_room':
      return `Granted ${log.action.replace('grant_', '').replace('_', ' ')} access to ${m.buyer_type} buyer`;
    case 'revoke_teaser':
    case 'revoke_full_memo':
    case 'revoke_data_room':
      return `Revoked ${log.action.replace('revoke_', '').replace('_', ' ')} access`;
    case 'fee_agreement_override':
      return `Fee agreement override: ${m.reason}`;
    case 'generate_memo':
      return `Generated ${m.memo_type} memo (${m.branding})`;
    case 'send_memo_email':
      return `Sent ${m.memo_type} to ${m.buyer_name} at ${m.email_address}`;
    case 'bulk_grant':
      return `Bulk granted access to ${m.buyer_count} buyers (${m.success_count} succeeded)`;
    default:
      return log.action.replace(/_/g, ' ');
  }
}
