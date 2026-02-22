/**
 * AccessMatrixPanel: Buyer access management with tracked link distribution
 *
 * Features:
 * - Table of buyers with teaser/full memo/data room checkboxes
 * - Send tracked link (copy or email) per buyer
 * - Link tracking columns (sent date, method, email)
 * - Fee agreement warning when enabling full memo without signed agreement
 * - Bulk toggle for multiple buyers
 * - Expiration date picker
 * - Expandable audit history per buyer
 * - Improved add buyer dialog with multi-select
 * - Revoke access
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield, UserPlus, AlertTriangle, Loader2, Ban, Link2, Mail,
  Copy, ChevronDown, ChevronRight, CalendarIcon, Clock, Check,
  ExternalLink, Send,
} from 'lucide-react';
import {
  useDataRoomAccess,
  useUpdateAccess,
  useRevokeAccess,
  useBulkUpdateAccess,
  DataRoomAccessRecord,
} from '@/hooks/admin/data-room/use-data-room';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

interface AccessMatrixPanelProps {
  dealId: string;
  projectName?: string | null;
}

export function AccessMatrixPanel({ dealId, projectName }: AccessMatrixPanelProps) {
  const { data: accessRecords = [], isLoading } = useDataRoomAccess(dealId);
  const updateAccess = useUpdateAccess();
  const revokeAccess = useRevokeAccess();
  const bulkUpdate = useBulkUpdateAccess();
  const queryClient = useQueryClient();

  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sendLinkRecord, setSendLinkRecord] = useState<DataRoomAccessRecord | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [expirationRecord, setExpirationRecord] = useState<DataRoomAccessRecord | null>(null);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [addBuyerSelected, setAddBuyerSelected] = useState<Set<string>>(new Set());

  // Fetch available buyers for add dialog
  const { data: availableBuyers = [] } = useQuery({
    queryKey: ['available-buyers-for-access', dealId, buyerSearch],
    queryFn: async () => {
      let query = supabase
        .from('remarketing_buyers')
        .select('id, company_name, pe_firm_name, email_domain')
        .eq('archived', false)
        .order('company_name')
        .limit(50);

      if (buyerSearch) {
        query = query.or(`company_name.ilike.%${buyerSearch}%,pe_firm_name.ilike.%${buyerSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: showAddBuyer,
  });

  const activeRecords = accessRecords.filter(r => !r.revoked_at);
  const filteredRecords = activeRecords.filter(r =>
    !searchQuery ||
    r.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.buyer_company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = async (
    record: DataRoomAccessRecord,
    field: 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room',
    newValue: boolean
  ) => {
    // Full Memo and Data Room require a signed fee agreement — hard gate
    if ((field === 'can_view_full_memo' || field === 'can_view_data_room') && newValue && !record.fee_agreement_signed) {
      return;
    }

    updateAccess.mutate({
      deal_id: dealId,
      remarketing_buyer_id: record.remarketing_buyer_id || undefined,
      marketplace_user_id: record.marketplace_user_id || undefined,
      can_view_teaser: field === 'can_view_teaser' ? newValue : record.can_view_teaser,
      can_view_full_memo: field === 'can_view_full_memo' ? newValue : record.can_view_full_memo,
      can_view_data_room: field === 'can_view_data_room' ? newValue : record.can_view_data_room,
    };

    if (field === 'can_view_full_memo' && newValue && !record.fee_agreement_signed) {
      setPendingUpdate(updates);
      setShowFeeWarning(true);
      return;
    }

    updateAccess.mutate(updates);
  };

  const handleFeeOverride = () => {
    if (pendingUpdate) {
      updateAccess.mutate({
        ...pendingUpdate,
        fee_agreement_override_reason: overrideReason,
      });
    }
    setShowFeeWarning(false);
    setPendingUpdate(null);
    setOverrideReason('');
  };

  const handleAddBuyers = () => {
    addBuyerSelected.forEach(buyerId => {
      updateAccess.mutate({
        deal_id: dealId,
        remarketing_buyer_id: buyerId,
        can_view_teaser: true,
        can_view_full_memo: false,
        can_view_data_room: false,
      });
    });
    setShowAddBuyer(false);
    setAddBuyerSelected(new Set());
    setBuyerSearch('');
  };

  const handleCopyLink = async (record: DataRoomAccessRecord) => {
    if (!record.access_token) {
      toast.error('No access token generated for this buyer');
      return;
    }

    const baseUrl = window.location.origin;
    const link = `${baseUrl}/data-room/${dealId}?token=${record.access_token}`;

    await navigator.clipboard.writeText(link);

    // Update link tracking
    await supabase
      .from('data_room_access')
      .update({
        link_sent_at: new Date().toISOString(),
        link_sent_via: 'manual_copy',
      })
      .eq('id', record.access_id);

    queryClient.invalidateQueries({ queryKey: ['data-room-access', dealId] });
    toast.success('Link copied to clipboard');
  };

  const handleSendEmail = async () => {
    if (!sendLinkRecord || !sendEmail) return;

    const baseUrl = window.location.origin;
    const link = `${baseUrl}/data-room/${dealId}?token=${sendLinkRecord.access_token}`;

    // Update link tracking
    await supabase
      .from('data_room_access')
      .update({
        link_sent_at: new Date().toISOString(),
        link_sent_to_email: sendEmail,
        link_sent_via: 'email',
      })
      .eq('id', sendLinkRecord.access_id);

    // Open mailto with pre-filled content
    const subject = encodeURIComponent(`${projectName || 'Deal'} — Document Access`);
    const body = encodeURIComponent(
      `You have been granted access to view documents.\n\nClick here to view: ${link}\n\nPlease do not share this link.`
    );
    window.open(`mailto:${sendEmail}?subject=${subject}&body=${body}`, '_blank');

    queryClient.invalidateQueries({ queryKey: ['data-room-access', dealId] });
    setSendLinkRecord(null);
    setSendEmail('');
    toast.success('Email opened & link tracked');
  };

  const handleSetExpiration = async () => {
    if (!expirationRecord || !expirationDate) return;

    await supabase
      .from('data_room_access')
      .update({ expires_at: expirationDate.toISOString() })
      .eq('id', expirationRecord.access_id);

    queryClient.invalidateQueries({ queryKey: ['data-room-access', dealId] });
    setExpirationRecord(null);
    setExpirationDate(undefined);
    toast.success('Expiration date set');
  };

  const toggleRowExpanded = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  const handleBulkToggle = (field: 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room', value: boolean) => {
    // For full memo / data room, only include buyers with signed fee agreements
    const eligibleRecords = Array.from(selectedBuyers)
      .map(id => activeRecords.find(r => r.access_id === id))
      .filter((record): record is DataRoomAccessRecord => {
        if (!record) return false;
        if ((field === 'can_view_full_memo' || field === 'can_view_data_room') && value && !record.fee_agreement_signed) {
          return false;
        }
        return true;
      });

    if (eligibleRecords.length === 0) {
      toast({ title: 'No eligible buyers', description: 'Selected buyers need a signed fee agreement first.', variant: 'destructive' });
      return;
    }

    const buyerIds = eligibleRecords.map(record => ({
      remarketing_buyer_id: record.remarketing_buyer_id || undefined,
      marketplace_user_id: record.marketplace_user_id || undefined,
    }));

    bulkUpdate.mutate({
      deal_id: dealId,
      buyer_ids: buyerIds,
      can_view_teaser: field === 'can_view_teaser' ? value : false,
      can_view_full_memo: field === 'can_view_full_memo' ? value : false,
      can_view_data_room: field === 'can_view_data_room' ? value : false,
    });
    setSelectedBuyers(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading access records...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search buyers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          {selectedBuyers.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedBuyers.size} selected</Badge>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggle('can_view_teaser', true)}>
                Grant Teaser
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggle('can_view_data_room', true)}>
                Grant Data Room
              </Button>
            </div>
          )}
        </div>
        <Button onClick={() => setShowAddBuyer(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Buyer
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Access</p>
            <p className="text-xl font-bold">{activeRecords.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Links Sent</p>
            <p className="text-xl font-bold">{activeRecords.filter(r => r.link_sent_at).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Fee Agreements</p>
            <p className="text-xl font-bold">{activeRecords.filter(r => r.fee_agreement_signed).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Full Memo Access</p>
            <p className="text-xl font-bold">{activeRecords.filter(r => r.can_view_full_memo).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Access Matrix Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Shield className="mx-auto h-8 w-8 mb-2" />
              No buyers have been granted access yet
            </div>
          ) : (
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedBuyers.size === filteredRecords.length && filteredRecords.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBuyers(new Set(filteredRecords.map(r => r.access_id)));
                        } else {
                          setSelectedBuyers(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-center w-20">Teaser</TableHead>
                  <TableHead className="text-center w-20">Full Memo</TableHead>
                  <TableHead className="text-center w-20">Data Room</TableHead>
                  <TableHead className="text-center w-24">Fee Agmt</TableHead>
                  <TableHead className="w-28">Link Status</TableHead>
                  <TableHead className="w-28">Last Access</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => {
                  const isExpanded = expandedRows.has(record.access_id);
                  return (
                    <>
                      <TableRow key={record.access_id} className="group">
                        <TableCell className="px-2">
                          <button
                            onClick={() => toggleRowExpanded(record.access_id)}
                            className="p-0.5 rounded hover:bg-accent"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={selectedBuyers.has(record.access_id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedBuyers);
                              if (checked) next.add(record.access_id);
                              else next.delete(record.access_id);
                              setSelectedBuyers(next);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{record.buyer_name}</p>
                            {record.buyer_company && record.buyer_company !== record.buyer_name && (
                              <p className="text-xs text-muted-foreground">{record.buyer_company}</p>
                            )}
                            {record.contact_title && (
                              <p className="text-xs text-muted-foreground">{record.contact_title}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={record.can_view_teaser}
                            onCheckedChange={(checked) =>
                              handleToggle(record, 'can_view_teaser', !!checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={record.can_view_full_memo}
                            onCheckedChange={(checked) =>
                              handleToggle(record, 'can_view_full_memo', !!checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={record.can_view_data_room}
                            onCheckedChange={(checked) =>
                              handleToggle(record, 'can_view_data_room', !!checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {record.fee_agreement_signed ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">Signed</Badge>
                          ) : record.fee_agreement_override ? (
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                              Override
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">None</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.link_sent_at ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                {record.link_sent_via === 'email' ? (
                                  <Mail className="h-3 w-3 text-blue-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(record.link_sent_at), { addSuffix: true })}
                                </span>
                              </div>
                              {record.link_sent_to_email && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                  {record.link_sent_to_email}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not sent</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.last_access_at ? (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(record.last_access_at), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Copy Link */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCopyLink(record)}
                              title="Copy tracked link"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                            {/* Send via Email */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSendLinkRecord(record);
                                setSendEmail(record.link_sent_to_email || '');
                              }}
                              title="Send link via email"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                            {/* Set Expiration */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setExpirationRecord(record);
                                setExpirationDate(record.expires_at ? new Date(record.expires_at) : undefined);
                              }}
                              title="Set expiration"
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                            {/* Revoke */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will immediately revoke all data room access for {record.buyer_name}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeAccess.mutate({ accessId: record.access_id, dealId })}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded audit row */}
                      {isExpanded && (
                        <TableRow key={`${record.access_id}-detail`}>
                          <TableCell colSpan={10} className="bg-muted/30 py-3 px-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Access Timeline</p>
                              <div className="space-y-1.5">
                                <TimelineItem
                                  label="Access granted"
                                  date={record.granted_at}
                                  icon={<Check className="h-3 w-3 text-green-600" />}
                                />
                                {record.link_sent_at && (
                                  <TimelineItem
                                    label={`Link ${record.link_sent_via === 'email' ? 'emailed' : 'copied'}${record.link_sent_to_email ? ` to ${record.link_sent_to_email}` : ''}`}
                                    date={record.link_sent_at}
                                    icon={record.link_sent_via === 'email' ? <Mail className="h-3 w-3 text-blue-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                                  />
                                )}
                                {record.last_access_at && (
                                  <TimelineItem
                                    label="Last viewed documents"
                                    date={record.last_access_at}
                                    icon={<ExternalLink className="h-3 w-3 text-primary" />}
                                  />
                                )}
                                {record.expires_at && (
                                  <TimelineItem
                                    label={`Access ${new Date(record.expires_at) < new Date() ? 'expired' : 'expires'}`}
                                    date={record.expires_at}
                                    icon={<Clock className="h-3 w-3 text-amber-500" />}
                                  />
                                )}
                                {record.fee_agreement_override && (
                                  <div className="flex items-start gap-2 text-xs">
                                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5" />
                                    <div>
                                      <span className="text-muted-foreground">Fee agreement overridden</span>
                                      {record.fee_agreement_override_reason && (
                                        <p className="text-muted-foreground italic">"{record.fee_agreement_override_reason}"</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Access Token */}
                              {record.access_token && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">
                                    Token: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{record.access_token.slice(0, 12)}…</code>
                                  </p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Send Email Dialog */}
      <Dialog open={!!sendLinkRecord} onOpenChange={(open) => { if (!open) setSendLinkRecord(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Tracked Link
            </DialogTitle>
            <DialogDescription>
              Send a tracked document access link to {sendLinkRecord?.buyer_name} via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Email address</label>
              <Input
                type="email"
                placeholder="buyer@example.com"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">What happens:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Your email client opens with a pre-filled message</li>
                <li>The link will be tracked — you'll see when it's accessed</li>
                <li>The send is logged in the buyer's audit trail</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendLinkRecord(null)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={!sendEmail}>
              <Send className="mr-2 h-4 w-4" />
              Open Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expiration Date Dialog */}
      <Dialog open={!!expirationRecord} onOpenChange={(open) => { if (!open) setExpirationRecord(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Set Access Expiration
            </DialogTitle>
            <DialogDescription>
              Set an expiration date for {expirationRecord?.buyer_name}'s access. After this date, they won't be able to view documents.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={expirationDate}
              onSelect={setExpirationDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpirationRecord(null)}>Cancel</Button>
            <Button onClick={handleSetExpiration} disabled={!expirationDate}>
              Set Expiration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Agreement Warning Dialog */}
      <Dialog open={showFeeWarning} onOpenChange={setShowFeeWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Fee Agreement Required
            </DialogTitle>
            <DialogDescription>
              This buyer does not have a signed fee agreement. Releasing the full memo reveals the company name.
              Do you want to proceed anyway?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Override reason (required)</label>
            <Textarea
              placeholder="Why is it okay to share the full memo without a fee agreement?"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFeeWarning(false);
              setPendingUpdate(null);
              setOverrideReason('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleFeeOverride}
              disabled={!overrideReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Override & Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Buyer Dialog — improved with multi-select */}
      <Dialog open={showAddBuyer} onOpenChange={(open) => {
        setShowAddBuyer(open);
        if (!open) {
          setAddBuyerSelected(new Set());
          setBuyerSearch('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Buyers to Data Room</DialogTitle>
            <DialogDescription>
              Select one or more buyers to grant initial teaser access. You can configure their access toggles after adding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search by company or firm name..."
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
              {availableBuyers.map(buyer => {
                const alreadyAdded = activeRecords.some(r => r.remarketing_buyer_id === buyer.id);
                const isSelected = addBuyerSelected.has(buyer.id);
                return (
                  <button
                    key={buyer.id}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-3
                      ${alreadyAdded ? 'opacity-50 cursor-not-allowed bg-muted' : isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent cursor-pointer'}`}
                    onClick={() => {
                      if (alreadyAdded) return;
                      const next = new Set(addBuyerSelected);
                      if (next.has(buyer.id)) next.delete(buyer.id);
                      else next.add(buyer.id);
                      setAddBuyerSelected(next);
                    }}
                    disabled={alreadyAdded}
                  >
                    <Checkbox checked={isSelected || alreadyAdded} disabled={alreadyAdded} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{buyer.company_name || buyer.pe_firm_name}</p>
                      {buyer.email_domain && (
                        <p className="text-xs text-muted-foreground">{buyer.email_domain}</p>
                      )}
                    </div>
                    {alreadyAdded && <Badge variant="secondary" className="text-xs flex-shrink-0">Added</Badge>}
                  </button>
                );
              })}
              {availableBuyers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No buyers found</p>
              )}
            </div>
            {addBuyerSelected.size > 0 && (
              <p className="text-xs text-muted-foreground">{addBuyerSelected.size} buyer(s) selected</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBuyer(false)}>Cancel</Button>
            <Button onClick={handleAddBuyers} disabled={addBuyerSelected.size === 0}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add {addBuyerSelected.size > 0 ? `${addBuyerSelected.size} Buyer(s)` : 'Buyers'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Timeline Item ───

function TimelineItem({ label, date, icon }: { label: string; date: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground/60 ml-auto">
        {format(new Date(date), 'MMM d, yyyy h:mm a')}
      </span>
    </div>
  );
}
