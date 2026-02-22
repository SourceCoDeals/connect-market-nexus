/**
 * DocumentActivityTab: Permanent chronological feed of every document release.
 *
 * Shows: buyer, document, method badge, sent by, timestamp, NDA/fee status,
 * tracked link open status with revoke button.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Link2, Download, Eye, EyeOff, X, FileText,
  Clock, User, Shield, DownloadCloud, Filter,
} from 'lucide-react';
import {
  useReleaseLog,
  useTrackedLinks,
  useRevokeTrackedLink,
  type ReleaseLogEntry,
} from '@/hooks/admin/use-document-distribution';
import { format, formatDistanceToNow } from 'date-fns';

interface DocumentActivityTabProps {
  dealId: string;
}

const METHOD_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  tracked_link: { label: 'Tracked Link', color: 'bg-blue-100 text-blue-800', icon: <Link2 className="h-3 w-3" /> },
  pdf_download: { label: 'PDF Download', color: 'bg-gray-100 text-gray-700', icon: <Download className="h-3 w-3" /> },
  auto_campaign: { label: 'Campaign', color: 'bg-purple-100 text-purple-800', icon: <FileText className="h-3 w-3" /> },
  data_room_grant: { label: 'Data Room', color: 'bg-green-100 text-green-800', icon: <Shield className="h-3 w-3" /> },
};

export function DocumentActivityTab({ dealId }: DocumentActivityTabProps) {
  const { data: releaseLog = [], isLoading } = useReleaseLog(dealId);
  const { data: trackedLinks = [] } = useTrackedLinks(dealId);
  const revokeMutation = useRevokeTrackedLink();
  const [filterBy, setFilterBy] = useState<'all' | 'buyer' | 'document'>('all');
  const [filterValue, setFilterValue] = useState('');

  // Get linked tracked link for a release log entry
  const getTrackedLink = (entry: ReleaseLogEntry) => {
    if (!entry.tracked_link_id) return null;
    return trackedLinks.find(tl => tl.id === entry.tracked_link_id);
  };

  // Filter entries
  const filteredLog = releaseLog.filter(entry => {
    if (filterBy === 'all' || !filterValue) return true;
    if (filterBy === 'buyer') {
      return entry.buyer_name?.toLowerCase().includes(filterValue.toLowerCase()) ||
             entry.buyer_firm?.toLowerCase().includes(filterValue.toLowerCase());
    }
    return true;
  });

  // Unique buyers for filter
  const uniqueBuyers = [...new Set(releaseLog.map(e => e.buyer_name))].filter(Boolean);

  // Export CSV
  const handleExport = () => {
    const headers = [
      'Date', 'Buyer', 'Firm', 'Email', 'Document', 'Method',
      'NDA Status', 'Fee Agreement', 'Sent By', 'Opened', 'Open Count', 'Notes',
    ];
    const rows = filteredLog.map(entry => {
      const link = getTrackedLink(entry);
      return [
        entry.released_at ? format(new Date(entry.released_at), 'yyyy-MM-dd HH:mm:ss') : '',
        entry.buyer_name || '',
        entry.buyer_firm || '',
        entry.buyer_email || '',
        entry.document_id || '',
        entry.release_method,
        entry.nda_status_at_release || '',
        entry.fee_agreement_status_at_release || '',
        entry.released_by || '',
        link ? (link.first_opened_at ? 'Yes' : 'No') : 'N/A',
        link ? String(link.open_count) : 'N/A',
        entry.release_notes || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `release-log-${dealId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterBy} onValueChange={v => { setFilterBy(v as 'all' | 'buyer' | 'document'); setFilterValue(''); }}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="buyer">By Buyer</SelectItem>
              <SelectItem value="document">By Document</SelectItem>
            </SelectContent>
          </Select>
          {filterBy === 'buyer' && (
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="Select buyer..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueBuyers.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <DownloadCloud className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading activity log...</div>
      ) : filteredLog.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No document releases yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLog.map(entry => {
            const link = getTrackedLink(entry);
            const methodInfo = METHOD_BADGES[entry.release_method] || METHOD_BADGES.pdf_download;

            return (
              <Card key={entry.id}>
                <CardContent className="py-3 space-y-2">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{entry.buyer_name}</span>
                        {entry.buyer_firm && (
                          <span className="text-sm text-muted-foreground">({entry.buyer_firm})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(entry.released_at), 'MMM d, yyyy h:mm a')}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(entry.released_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <Badge className={`${methodInfo.color} flex items-center gap-1`} variant="secondary">
                      {methodInfo.icon}
                      {methodInfo.label}
                    </Badge>
                  </div>

                  {/* Legal status at send */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${entry.nda_status_at_release === 'signed' ? 'bg-green-50 text-green-700' : ''}`}
                    >
                      NDA: {entry.nda_status_at_release || 'N/A'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${entry.fee_agreement_status_at_release === 'signed' ? 'bg-green-50 text-green-700' : ''}`}
                    >
                      Fee: {entry.fee_agreement_status_at_release || 'N/A'}
                    </Badge>
                  </div>

                  {/* Tracked link engagement */}
                  {entry.release_method === 'tracked_link' && link && (
                    <div className="flex items-center justify-between bg-muted/50 rounded p-2">
                      <div className="flex items-center gap-3 text-sm">
                        {link.first_opened_at ? (
                          <>
                            <div className="flex items-center gap-1 text-green-700">
                              <Eye className="h-3.5 w-3.5" />
                              Opened {link.open_count}x
                            </div>
                            <span className="text-xs text-muted-foreground">
                              First: {format(new Date(link.first_opened_at), 'MMM d, h:mm a')}
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <EyeOff className="h-3.5 w-3.5" />
                            Not yet opened
                          </div>
                        )}
                      </div>
                      {link.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 h-7 text-xs"
                          onClick={() => revokeMutation.mutate({
                            linkId: link.id,
                            dealId,
                          })}
                          disabled={revokeMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Revoke
                        </Button>
                      )}
                      {!link.is_active && (
                        <Badge variant="destructive" className="text-xs">Revoked</Badge>
                      )}
                    </div>
                  )}

                  {entry.release_method === 'pdf_download' && (
                    <div className="text-xs text-muted-foreground italic">
                      Sent — no open tracking
                    </div>
                  )}

                  {/* Notes */}
                  {entry.release_notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      {entry.release_notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
