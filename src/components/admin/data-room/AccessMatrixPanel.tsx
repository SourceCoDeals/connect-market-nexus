/**
 * AccessMatrixPanel: Buyer access management with 3 independent toggles
 *
 * Features:
 * - Table of buyers with teaser/full memo/data room checkboxes
 * - Fee agreement warning when enabling full memo without signed agreement
 * - Bulk toggle for multiple buyers
 * - Revoke access
 * - Add buyer dialog
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield, UserPlus, Users, AlertTriangle, Loader2, Ban, Clock,
} from 'lucide-react';
import {
  useDataRoomAccess,
  useUpdateAccess,
  useRevokeAccess,
  useBulkUpdateAccess,
  DataRoomAccessRecord,
} from '@/hooks/admin/data-room/use-data-room';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface AccessMatrixPanelProps {
  dealId: string;
}

export function AccessMatrixPanel({ dealId }: AccessMatrixPanelProps) {
  const { data: accessRecords = [], isLoading } = useDataRoomAccess(dealId);
  const updateAccess = useUpdateAccess();
  const revokeAccess = useRevokeAccess();
  const bulkUpdate = useBulkUpdateAccess();

  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [showFeeWarning, setShowFeeWarning] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');

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
    const updates = {
      deal_id: dealId,
      remarketing_buyer_id: record.remarketing_buyer_id || undefined,
      marketplace_user_id: record.marketplace_user_id || undefined,
      can_view_teaser: field === 'can_view_teaser' ? newValue : record.can_view_teaser,
      can_view_full_memo: field === 'can_view_full_memo' ? newValue : record.can_view_full_memo,
      can_view_data_room: field === 'can_view_data_room' ? newValue : record.can_view_data_room,
    };

    // Check fee agreement for full memo
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

  const handleAddBuyer = (buyerId: string) => {
    updateAccess.mutate({
      deal_id: dealId,
      remarketing_buyer_id: buyerId,
      can_view_teaser: true,
      can_view_full_memo: false,
      can_view_data_room: false,
    });
    setShowAddBuyer(false);
  };

  const handleBulkToggle = (field: 'can_view_teaser' | 'can_view_full_memo' | 'can_view_data_room', value: boolean) => {
    const buyerIds = Array.from(selectedBuyers).map(id => {
      const record = activeRecords.find(r => r.access_id === id);
      return {
        remarketing_buyer_id: record?.remarketing_buyer_id || undefined,
        marketplace_user_id: record?.marketplace_user_id || undefined,
      };
    });

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

      {/* Access Matrix Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Shield className="mx-auto h-8 w-8 mb-2" />
              No buyers have been granted access yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="text-center w-24">Teaser</TableHead>
                  <TableHead className="text-center w-24">Full Memo</TableHead>
                  <TableHead className="text-center w-24">Data Room</TableHead>
                  <TableHead className="text-center w-28">Fee Agreement</TableHead>
                  <TableHead className="w-28">Last Access</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => (
                  <TableRow key={record.access_id}>
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
                      {record.last_access_at ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.last_access_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                              They will no longer be able to view any documents.
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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

      {/* Add Buyer Dialog */}
      <Dialog open={showAddBuyer} onOpenChange={setShowAddBuyer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Buyer to Data Room</DialogTitle>
            <DialogDescription>
              Select a buyer to grant data room access. You can configure their access toggles after adding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search buyers..."
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {availableBuyers.map(buyer => {
                const alreadyAdded = activeRecords.some(r => r.remarketing_buyer_id === buyer.id);
                return (
                  <button
                    key={buyer.id}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                      ${alreadyAdded ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-accent cursor-pointer'}`}
                    onClick={() => !alreadyAdded && handleAddBuyer(buyer.id)}
                    disabled={alreadyAdded}
                  >
                    <p className="font-medium">{buyer.company_name || buyer.pe_firm_name}</p>
                    {buyer.email_domain && (
                      <p className="text-xs text-muted-foreground">{buyer.email_domain}</p>
                    )}
                    {alreadyAdded && <Badge variant="secondary" className="text-xs mt-1">Already added</Badge>}
                  </button>
                );
              })}
              {availableBuyers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No buyers found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
