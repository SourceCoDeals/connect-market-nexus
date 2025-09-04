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
      <div className="p-6 space-y-6">
        {/* Document Status - Clean Design */}
        <div className="space-y-4">
          <h4 className="font-medium text-base text-foreground">Document Status</h4>
          
          <div className="space-y-3">
            {/* NDA Status */}
            <div className="flex items-center justify-between py-3 border-b border-border/20">
              <div className="flex items-center gap-3">
                <ndaStatus.icon className={`h-4 w-4 ${ndaStatus.color}`} />
                <div>
                  <span className="font-medium text-sm">NDA</span>
                  <span className="text-xs text-muted-foreground ml-2">{ndaStatus.label}</span>
                </div>
              </div>
              <Switch
                checked={deal.nda_status === 'signed'}
                onCheckedChange={handleNDAToggle}
                disabled={!deal.contact_email}
              />
            </div>

            {/* Fee Agreement Status */}
            <div className="flex items-center justify-between py-3 border-b border-border/20">
              <div className="flex items-center gap-3">
                <feeStatus.icon className={`h-4 w-4 ${feeStatus.color}`} />
                <div>
                  <span className="font-medium text-sm">Fee Agreement</span>
                  <span className="text-xs text-muted-foreground ml-2">{feeStatus.label}</span>
                </div>
              </div>
              <Switch
                checked={deal.fee_agreement_status === 'signed'}
                onCheckedChange={handleFeeAgreementToggle}
                disabled={!deal.contact_email}
              />
            </div>
          </div>
        </div>

        {/* Deal Owner Assignment */}
        <div className="space-y-4">
          <h4 className="font-medium text-base text-foreground">Deal Owner</h4>
          
          <div className="flex items-center justify-between py-3 border-b border-border/20">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assigned to</span>
              {assignedAdmin && (
                <span className="text-sm text-muted-foreground">{assignedAdmin.displayName}</span>
              )}
            </div>
            
            <Select value={deal.assigned_to || 'unassigned'} onValueChange={(value) => handleOwnerChange(value === 'unassigned' ? null : value)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Assign">
                  {assignedAdmin ? assignedAdmin.displayName : "Unassigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {allAdminProfiles && Object.values(allAdminProfiles).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-base text-foreground">Timeline</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Time in Stage</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deal Age</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(deal.deal_created_at))}
              </span>
            </div>
          </div>
        </div>

        {/* Status Information */}
        {(deal.followed_up || deal.pending_tasks > 0) && (
          <div className="space-y-4">
            <h4 className="font-medium text-base text-foreground">Status</h4>
            
            <div className="space-y-3">
              {deal.followed_up && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">Follow-up Complete</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {deal.followed_up_at ? formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true }) : ''}
                  </span>
                </div>
              )}

              {deal.pending_tasks > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">Pending Tasks</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {deal.pending_tasks} task{deal.pending_tasks !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}