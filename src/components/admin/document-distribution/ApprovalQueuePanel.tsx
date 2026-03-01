/**
 * ApprovalQueuePanel: Marketplace approval queue for a deal or global view.
 *
 * Shows pending connection requests that need manual approval before
 * any documents are released.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Check, X, Clock, User, Building2, Mail,
  MessageSquare, Shield, Loader2, Link2, AlertTriangle,
} from 'lucide-react';
import {
  useApprovalQueue,
  useApproveMarketplaceBuyer,
  useDeclineMarketplaceBuyer,
  type ApprovalQueueEntry,
} from '@/hooks/admin/use-document-distribution';
import { formatDistanceToNow } from 'date-fns';
import { APPROVAL_STATUSES } from '@/constants';

interface ApprovalQueuePanelProps {
  dealId?: string;
  showDealName?: boolean;
}

const DECLINE_CATEGORIES = [
  { value: 'not_qualified', label: 'Not Qualified' },
  { value: 'wrong_size', label: 'Wrong Size' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
];

export function ApprovalQueuePanel({ dealId }: ApprovalQueuePanelProps) {
  const { data: queue = [], isLoading } = useApprovalQueue(dealId);
  const approveMutation = useApproveMarketplaceBuyer();
  const declineMutation = useDeclineMarketplaceBuyer();

  const [declineEntry, setDeclineEntry] = useState<ApprovalQueueEntry | null>(null);
  const [declineCategory, setDeclineCategory] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [sendDeclineEmail, setSendDeclineEmail] = useState(false);
  const [approvedLink, setApprovedLink] = useState<string | null>(null);

  const pendingQueue = queue.filter(e => e.status === APPROVAL_STATUSES.PENDING);
  const recentQueue = queue.filter(e => e.status !== APPROVAL_STATUSES.PENDING).slice(0, 5);

  const handleApprove = async (entry: ApprovalQueueEntry) => {
    const result = await approveMutation.mutateAsync({
      approval_queue_id: entry.id,
    });
    if (result.link_url) {
      setApprovedLink(result.link_url);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineEntry || !declineCategory) return;
    await declineMutation.mutateAsync({
      approval_queue_id: declineEntry.id,
      decline_category: declineCategory,
      decline_reason: declineReason || undefined,
      send_decline_email: sendDeclineEmail,
    });
    setDeclineEntry(null);
    setDeclineCategory('');
    setDeclineReason('');
    setSendDeclineEmail(false);
  };

  return (
    <div className="space-y-4">
      {/* Pending approvals */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading approvals...</div>
      ) : pendingQueue.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">No pending approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingQueue.map(entry => (
            <Card key={entry.id} className="border-amber-200">
              <CardContent className="py-4 space-y-3">
                {/* Buyer info */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{entry.buyer_name}</span>
                      {entry.match_confidence === 'email_exact' && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          <Shield className="h-3 w-3 mr-0.5" />
                          Known Buyer
                        </Badge>
                      )}
                      {entry.match_confidence === 'firm_name' && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Firm Match
                        </Badge>
                      )}
                      {entry.match_confidence === 'none' && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Unknown
                        </Badge>
                      )}
                    </div>
                    {entry.buyer_firm && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {entry.buyer_firm}
                        {entry.buyer_role && <span> · {entry.buyer_role}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {entry.buyer_email}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Submitted {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>

                {/* Buyer message */}
                {entry.buyer_message && (
                  <div className="bg-muted/50 rounded p-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Message
                    </div>
                    <p className="text-sm">{entry.buyer_message}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(entry)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    )}
                    Approve & Send Teaser
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeclineEntry(entry)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent decisions */}
      {recentQueue.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Recent Decisions
          </h4>
          {recentQueue.map(entry => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
            >
              <div className="flex items-center gap-2">
                <span>{entry.buyer_name}</span>
                {entry.buyer_firm && (
                  <span className="text-muted-foreground">({entry.buyer_firm})</span>
                )}
              </div>
              <Badge
                variant={entry.status === APPROVAL_STATUSES.APPROVED ? 'default' : 'destructive'}
                className={`text-xs ${entry.status === APPROVAL_STATUSES.APPROVED ? 'bg-green-100 text-green-800' : ''}`}
              >
                {entry.status === APPROVAL_STATUSES.APPROVED ? 'Approved' : 'Declined'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Approved link dialog */}
      <Dialog open={!!approvedLink} onOpenChange={() => setApprovedLink(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buyer Approved</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              The buyer has been approved and the Anonymous Teaser has been sent via tracked link.
            </p>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-500" />
              <code className="text-xs bg-muted p-1 rounded flex-1 break-all">
                {approvedLink}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setApprovedLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={!!declineEntry} onOpenChange={() => setDeclineEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Buyer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Select value={declineCategory} onValueChange={setDeclineCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {DECLINE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-decline"
                checked={sendDeclineEmail}
                onCheckedChange={v => setSendDeclineEmail(!!v)}
              />
              <label htmlFor="send-decline" className="text-sm">
                Send decline email to buyer
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineEntry(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeclineSubmit}
              disabled={!declineCategory || declineMutation.isPending}
            >
              {declineMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
