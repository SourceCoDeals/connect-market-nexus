import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { User, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineDetailOverviewProps {
  deal: Deal;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles } = useAdminProfiles([]);
  const { data: assignedAdminProfile } = useAdminProfiles([deal.assigned_to]);
  const updateDeal = useUpdateDeal();

  const handleOwnerChange = (adminId: string | null) => {
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  const handleNDAToggle = (checked: boolean) => {
    // For now, we'll update the deal directly since we don't have userId
    // This could be enhanced to fetch userId from connection_request_id
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { nda_status: checked ? 'signed' : 'not_sent' }
    });
  };

  const handleFeeAgreementToggle = (checked: boolean) => {
    // For now, we'll update the deal directly since we don't have userId
    // This could be enhanced to fetch userId from connection_request_id
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { fee_agreement_status: checked ? 'signed' : 'not_sent' }
    });
  };

  const assignedAdmin = deal.assigned_to && assignedAdminProfile ? assignedAdminProfile[deal.assigned_to] : null;

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'signed':
        return { icon: CheckCircle, label: 'Signed', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'sent':
        return { icon: Clock, label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'not_sent':
      default:
        return { icon: AlertTriangle, label: 'Not Sent', color: 'text-amber-600', bg: 'bg-amber-50' };
    }
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        {/* Document Status Section */}
        <div className="space-y-6">
          <h4 className="font-semibold text-base tracking-tight">Document Status</h4>
          
          <div className="grid grid-cols-2 gap-6">
            {/* NDA Status */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${ndaStatus.bg}`}>
                      <ndaStatus.icon className={`h-4 w-4 ${ndaStatus.color}`} />
                    </div>
                    <div>
                      <h5 className="font-medium text-sm">NDA Status</h5>
                      <p className="text-xs text-muted-foreground mt-1">{ndaStatus.label}</p>
                    </div>
                  </div>
                  <Switch
                    checked={deal.nda_status === 'signed'}
                    onCheckedChange={handleNDAToggle}
                    disabled={!deal.contact_email}
                  />
                </div>
                
                {deal.nda_status === 'signed' && (
                  <div className="text-xs text-muted-foreground">
                    Signed status confirmed
                  </div>
                )}
              </div>
            </Card>

            {/* Fee Agreement Status */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${feeStatus.bg}`}>
                      <feeStatus.icon className={`h-4 w-4 ${feeStatus.color}`} />
                    </div>
                    <div>
                      <h5 className="font-medium text-sm">Fee Agreement</h5>
                      <p className="text-xs text-muted-foreground mt-1">{feeStatus.label}</p>
                    </div>
                  </div>
                  <Switch
                    checked={deal.fee_agreement_status === 'signed'}
                    onCheckedChange={handleFeeAgreementToggle}
                    disabled={!deal.contact_email}
                  />
                </div>
                
                {deal.fee_agreement_status === 'signed' && (
                  <div className="text-xs text-muted-foreground">
                    Signed status confirmed
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Deal Owner Assignment */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base tracking-tight">Deal Assignment</h4>
          
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deal Owner</span>
              </div>
              
              <Select value={deal.assigned_to || 'unassigned'} onValueChange={(value) => handleOwnerChange(value === 'unassigned' ? null : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign deal owner">
                    {assignedAdmin ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {assignedAdmin.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm">{assignedAdmin.displayName}</span>
                      </div>
                    ) : (
                      "Assign deal owner"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {allAdminProfiles && Object.values(allAdminProfiles).map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {admin.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <span>{admin.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        </div>

        {/* Timeline Information */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base tracking-tight">Timeline</h4>
          
          <div className="grid grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time in Stage</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Deal Age</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(deal.deal_created_at))}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Follow-up Status */}
        {(deal.followed_up || deal.pending_tasks > 0) && (
          <div className="space-y-4">
            <h4 className="font-semibold text-base tracking-tight">Status Updates</h4>
            
            <div className="space-y-3">
              {deal.followed_up && (
                <Card className="p-4 border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Follow-up Complete</p>
                      <p className="text-xs text-emerald-700">
                        Followed up {deal.followed_up_at ? formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {deal.pending_tasks > 0 && (
                <Card className="p-4 border-amber-200 bg-amber-50/50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Pending Tasks</p>
                      <p className="text-xs text-amber-700">
                        {deal.pending_tasks} task{deal.pending_tasks !== 1 ? 's' : ''} require attention
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}