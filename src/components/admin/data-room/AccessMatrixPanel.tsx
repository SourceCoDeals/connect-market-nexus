/**
 * AccessMatrixPanel: Buyer access management with tracked link distribution
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Shield,
  UserPlus,
  AlertTriangle,
  Loader2,
  Link2,
  Mail,
  Copy,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
  ExternalLink,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAccessMatrix } from './useAccessMatrix';
import { AddAccessDialog } from './AddAccessDialog';
import {
  RevokeAccessButton,
  SendEmailDialog,
  ExpirationDialog,
  FeeWarningDialog,
} from './RevokeDialog';

interface AccessMatrixPanelProps {
  dealId: string;
  projectName?: string | null;
}

export function AccessMatrixPanel({ dealId, projectName }: AccessMatrixPanelProps) {
  const {
    isLoading,
    activeRecords,
    filteredRecords,
    availableBuyers,

    searchQuery,
    setSearchQuery,

    selectedBuyers,
    setSelectedBuyers,

    expandedRows,
    toggleRowExpanded,

    showAddBuyer,
    setShowAddBuyer,
    buyerSearch,
    setBuyerSearch,
    addBuyerSelected,
    setAddBuyerSelected,
    handleAddBuyers,

    handleToggle,
    handleBulkToggle,

    showFeeWarning,
    setShowFeeWarning,
    setPendingUpdate,
    overrideReason,
    setOverrideReason,
    handleFeeOverride,

    handleCopyLink,
    sendLinkRecord,
    setSendLinkRecord,
    sendEmail,
    setSendEmail,
    handleSendEmail,

    expirationRecord,
    setExpirationRecord,
    expirationDate,
    setExpirationDate,
    handleSetExpiration,

    revokeAccess,
  } = useAccessMatrix(dealId, projectName);

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle('can_view_teaser', true)}
              >
                Grant Teaser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle('can_view_data_room', true)}
              >
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
            <p className="text-xl font-bold">
              {activeRecords.filter((r) => r.link_sent_at).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Fee Agreements</p>
            <p className="text-xl font-bold">
              {activeRecords.filter((r) => r.fee_agreement_signed).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Full Memo Access</p>
            <p className="text-xl font-bold">
              {activeRecords.filter((r) => r.can_view_full_memo).length}
            </p>
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
                        checked={
                          selectedBuyers.size === filteredRecords.length &&
                          filteredRecords.length > 0
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedBuyers(new Set(filteredRecords.map((r) => r.access_id)));
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
                  {filteredRecords.map((record) => {
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
                              {record.buyer_company &&
                                record.buyer_company !== record.buyer_name && (
                                  <p className="text-xs text-muted-foreground">
                                    {record.buyer_company}
                                  </p>
                                )}
                              {record.contact_title && (
                                <p className="text-xs text-muted-foreground">
                                  {record.contact_title}
                                </p>
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
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800 text-xs"
                              >
                                Signed
                              </Badge>
                            ) : record.fee_agreement_override ? (
                              <Badge
                                variant="outline"
                                className="text-xs border-amber-300 text-amber-700"
                              >
                                Override
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                None
                              </Badge>
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
                                    {formatDistanceToNow(new Date(record.link_sent_at), {
                                      addSuffix: true,
                                    })}
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
                                {formatDistanceToNow(new Date(record.last_access_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCopyLink(record)}
                                title="Copy tracked link"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setExpirationRecord(record);
                                  setExpirationDate(
                                    record.expires_at ? new Date(record.expires_at) : undefined,
                                  );
                                }}
                                title="Set expiration"
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </Button>
                              <RevokeAccessButton
                                record={record}
                                onRevoke={(params) => revokeAccess.mutate(params)}
                                dealId={dealId}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${record.access_id}-detail`}>
                            <TableCell colSpan={10} className="bg-muted/30 py-3 px-6">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Access Timeline
                                </p>
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
                                      icon={
                                        record.link_sent_via === 'email' ? (
                                          <Mail className="h-3 w-3 text-blue-500" />
                                        ) : (
                                          <Copy className="h-3 w-3 text-muted-foreground" />
                                        )
                                      }
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
                                        <span className="text-muted-foreground">
                                          Fee agreement overridden
                                        </span>
                                        {record.fee_agreement_override_reason && (
                                          <p className="text-muted-foreground italic">
                                            "{record.fee_agreement_override_reason}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {record.access_token && (
                                  <div className="mt-2 pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">
                                      Token:{' '}
                                      <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                                        {record.access_token.slice(0, 12)}…
                                      </code>
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
      <SendEmailDialog
        record={sendLinkRecord}
        onClose={() => setSendLinkRecord(null)}
        email={sendEmail}
        onEmailChange={setSendEmail}
        onSend={handleSendEmail}
      />

      {/* Expiration Date Dialog */}
      <ExpirationDialog
        record={expirationRecord}
        onClose={() => setExpirationRecord(null)}
        date={expirationDate}
        onDateChange={setExpirationDate}
        onSave={handleSetExpiration}
      />

      {/* Fee Agreement Warning Dialog */}
      <FeeWarningDialog
        open={showFeeWarning}
        onOpenChange={setShowFeeWarning}
        overrideReason={overrideReason}
        onOverrideReasonChange={setOverrideReason}
        onOverride={handleFeeOverride}
        onCancel={() => {
          setShowFeeWarning(false);
          setPendingUpdate(null);
          setOverrideReason('');
        }}
      />

      {/* Add Buyer Dialog */}
      <AddAccessDialog
        open={showAddBuyer}
        onOpenChange={setShowAddBuyer}
        buyerSearch={buyerSearch}
        onBuyerSearchChange={setBuyerSearch}
        availableBuyers={availableBuyers}
        activeRecords={activeRecords}
        addBuyerSelected={addBuyerSelected}
        onAddBuyerSelectedChange={setAddBuyerSelected}
        onAddBuyers={handleAddBuyers}
      />
    </div>
  );
}

// ─── Timeline Item ───

function TimelineItem({
  label,
  date,
  icon,
}: {
  label: string;
  date: string;
  icon: React.ReactNode;
}) {
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
