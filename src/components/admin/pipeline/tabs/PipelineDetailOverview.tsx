import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, FileText, User, Calendar, Phone, Mail, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { useUpdateNDA, useLogNDAEmail } from '@/hooks/admin/use-nda';
import { useUpdateFeeAgreement, useLogFeeAgreementEmail } from '@/hooks/admin/use-fee-agreement';
import { supabase } from '@/integrations/supabase/client';

interface PipelineDetailOverviewProps {
  deal: Deal;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles, isLoading: adminProfilesLoading } = useAdminProfiles();
  const assignedAdmin = deal.assigned_to && allAdminProfiles ? allAdminProfiles[deal.assigned_to] : null;
  const updateDeal = useUpdateDeal();

  const handleOwnerChange = (value: string) => {
    const adminId = value === 'unassigned' ? null : value;
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  // Real NDA and Fee Agreement hooks with proper buyer_id handling
  const updateNDA = useUpdateNDA();
  const updateFeeAgreement = useUpdateFeeAgreement();
  const logNDAEmail = useLogNDAEmail();
  const logFeeAgreementEmail = useLogFeeAgreementEmail();

  // Get buyer_id from deal or fetch via connection request
  const getBuyerId = async () => {
    if (deal.buyer_id) return deal.buyer_id;
    
    // If no buyer_id, try to find via connection request
    if (deal.contact_email) {
      const { data: connectionRequest } = await supabase
        .from('connection_requests')
        .select('user_id')
        .eq('lead_email', deal.contact_email)
        .single();
      
      return connectionRequest?.user_id;
    }
    return null;
  };

  const handleNDAToggle = async (checked: boolean) => {
    const buyerId = await getBuyerId();
    if (!buyerId) return;
    
    updateNDA.mutate({
      userId: buyerId,
      isSigned: checked
    });
  };

  const handleFeeAgreementToggle = async (checked: boolean) => {
    const buyerId = await getBuyerId();
    if (!buyerId) return;
    
    updateFeeAgreement.mutate({
      userId: buyerId,
      isSigned: checked
    });
  };

  

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
      <div className="px-6 py-5 space-y-8">
        {/* Document Status - Apple Minimal with Admin Attribution */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Document Status</h4>
          
          <div className="space-y-1">
            {/* NDA Status */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.nda_status === 'signed' ? 'bg-emerald-500' : deal.nda_status === 'sent' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
                <div>
                  <span className="text-sm text-foreground">NDA</span>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground/70">{ndaStatus.label}</p>
                    {deal.nda_status === 'signed' && (
                      <p className="text-xs text-muted-foreground/60">
                        Marked signed by Admin
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                checked={deal.nda_status === 'signed'}
                onCheckedChange={handleNDAToggle}
                disabled={updateNDA.isPending || !deal.contact_email}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            <div className="h-px bg-border/20" />

            {/* Fee Agreement Status */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' : deal.fee_agreement_status === 'sent' ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
                <div>
                  <span className="text-sm text-foreground">Fee Agreement</span>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground/70">{feeStatus.label}</p>
                    {deal.fee_agreement_status === 'signed' && (
                      <p className="text-xs text-muted-foreground/60">
                        Marked signed by Admin
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                checked={deal.fee_agreement_status === 'signed'}
                onCheckedChange={handleFeeAgreementToggle}
                disabled={updateFeeAgreement.isPending || !deal.contact_email}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Deal Owner - Apple Minimal */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Deal Owner</h4>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm text-foreground">Assigned to</span>
              <p className="text-xs text-muted-foreground/70">
                {assignedAdmin?.displayName || 'Unassigned'}
              </p>
            </div>
            
            <Select 
              value={deal.assigned_to || 'unassigned'} 
              onValueChange={handleOwnerChange}
              disabled={adminProfilesLoading || updateDeal.isPending}
            >
              <SelectTrigger className="w-40 h-8 text-xs border-border/60">
                <SelectValue placeholder={adminProfilesLoading ? "Loading..." : "Assign admin"} />
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

        {/* Timeline - Apple Clean */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-foreground">Timeline</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground/70">Time in stage</span>
              <span className="text-sm font-medium text-foreground">
                {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground/70">Deal age</span>
              <span className="text-sm font-medium text-foreground">
                {formatDistanceToNow(new Date(deal.deal_created_at))}
              </span>
            </div>
          </div>
        </div>

        {/* Status - Conditional Apple Style */}
        {(deal.followed_up || deal.pending_tasks > 0) && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-foreground">Status</h4>
            
            <div className="space-y-3">
              {deal.followed_up && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-foreground">Follow-up completed</span>
                  </div>
                  <span className="text-xs text-muted-foreground/70">
                    {deal.followed_up_at ? formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true }) : ''}
                  </span>
                </div>
              )}

              {deal.pending_tasks > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-foreground">{deal.pending_tasks} pending tasks</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}