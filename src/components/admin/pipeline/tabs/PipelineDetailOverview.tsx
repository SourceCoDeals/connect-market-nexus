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
import { useUpdateLeadNDAStatus, useUpdateLeadFeeAgreementStatus } from '@/hooks/admin/requests/use-lead-status-updates';
import { useUpdateDealFollowup } from '@/hooks/admin/use-deal-followup';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCheck } from 'lucide-react';

interface PipelineDetailOverviewProps {
  deal: Deal;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles, isLoading: adminProfilesLoading } = useAdminProfiles();
  const assignedAdmin = deal.assigned_to && allAdminProfiles ? allAdminProfiles[deal.assigned_to] : null;
  const updateDeal = useUpdateDeal();
  const updateDealFollowup = useUpdateDealFollowup();
  
  const [followedUp, setFollowedUp] = React.useState(deal.followed_up || false);
  const [negativeFollowedUp, setNegativeFollowedUp] = React.useState(deal.negative_followed_up || false);
  const [otherDeals, setOtherDeals] = React.useState<any[]>([]);
  const [selectedOtherDeals, setSelectedOtherDeals] = React.useState<string[]>([]);
  
  // Fetch other deals from same buyer
  React.useEffect(() => {
    const fetchOtherDeals = async () => {
      if (!deal.connection_request_id || !deal.contact_email) return;

      const { data: allDeals } = await supabase
        .from('deals')
        .select('id, deal_title, listing_title, listing_real_company_name, stage_id, followed_up, negative_followed_up')
        .eq('contact_email', deal.contact_email)
        .neq('id', deal.deal_id);

      setOtherDeals(allDeals || []);
    };

    fetchOtherDeals();
  }, [deal.deal_id, deal.connection_request_id, deal.contact_email]);
  
  // Sync local state
  React.useEffect(() => {
    setFollowedUp(deal.followed_up || false);
    setNegativeFollowedUp(deal.negative_followed_up || false);
  }, [deal.followed_up, deal.negative_followed_up]);

  // Date validation helper
  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !isNaN(time);
  };

  const formatDateSafely = (value?: string | null) => {
    if (!isValidDate(value)) return 'N/A';
    try {
      return formatDistanceToNow(new Date(value!), { addSuffix: true });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleOwnerChange = (value: string) => {
    const adminId = value === 'unassigned' ? null : value;
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  // Use new hooks that update connection_requests
  const updateLeadNDA = useUpdateLeadNDAStatus();
  const updateLeadFeeAgreement = useUpdateLeadFeeAgreementStatus();

  const handleNDAToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    
    updateLeadNDA.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };

  const handleFeeAgreementToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    
    updateLeadFeeAgreement.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };
  
  const handleFollowupToggle = async (type: 'positive' | 'negative', newValue: boolean) => {
    if (type === 'positive') {
      setFollowedUp(newValue);
    } else {
      setNegativeFollowedUp(newValue);
    }

    // Get connection request IDs to update (current + selected others)
    const requestIdsToUpdate: string[] = [];
    
    if (deal.connection_request_id) {
      requestIdsToUpdate.push(deal.connection_request_id);
    }

    // Add selected other deals' connection requests
    const { data: selectedDealsData } = await supabase
      .from('deals')
      .select('connection_request_id')
      .in('id', selectedOtherDeals);

    if (selectedDealsData) {
      requestIdsToUpdate.push(...selectedDealsData
        .map(d => d.connection_request_id)
        .filter((id): id is string => !!id));
    }

    updateDealFollowup.mutate({
      dealId: deal.deal_id,
      connectionRequestIds: requestIdsToUpdate,
      isFollowedUp: newValue,
      followupType: type
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
      <div className="px-8 space-y-8 pb-8">
        {/* Buyer Intelligence Summary - Most Important */}
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Buyer Profile</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm text-foreground">
                  {deal.contact_name || 'Unknown Contact'}
                </span>
                {deal.contact_company && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm text-muted-foreground">
                      {deal.contact_company}
                    </span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-3 ml-5">
                <span className="text-xs text-muted-foreground font-mono">
                  {(() => {
                    switch (deal.buyer_type) {
                      case 'privateEquity': return 'Private Equity';
                      case 'familyOffice': return 'Family Office';
                      case 'searchFund': return 'Search Fund';
                      case 'corporate': return 'Corporate';
                      case 'individual': return 'Individual';
                      case 'independentSponsor': return 'Independent Sponsor';
                      default: return 'Unknown';
                    }
                  })()}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground font-mono">
                  Priority Score: {deal.buyer_priority_score || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Communication & Follow-up */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Communication</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Positive Follow-up */}
            <div className="p-4 border border-border/40 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="positive-followup-overview" className="text-sm text-foreground cursor-pointer">
                    Positive Follow-up
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ready for owner introduction
                  </p>
                </div>
                <Switch
                  id="positive-followup-overview"
                  checked={followedUp}
                  onCheckedChange={(checked) => handleFollowupToggle('positive', checked)}
                  className="scale-75"
                />
              </div>
              {followedUp && deal.followed_up_at && (
                <p className="text-xs text-muted-foreground/60 font-mono mt-2">
                  {formatDateSafely(deal.followed_up_at)}
                  {deal.followed_up_by && allAdminProfiles?.[deal.followed_up_by] && (
                    <span className="ml-1">by {allAdminProfiles[deal.followed_up_by].displayName}</span>
                  )}
                </p>
              )}
            </div>

            {/* Rejection Notice */}
            <div className="p-4 border border-border/40 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="negative-followup-overview" className="text-sm text-foreground cursor-pointer">
                    Rejection Notice
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send rejection to buyer
                  </p>
                </div>
                <Switch
                  id="negative-followup-overview"
                  checked={negativeFollowedUp}
                  onCheckedChange={(checked) => handleFollowupToggle('negative', checked)}
                  className="scale-75"
                />
              </div>
              {negativeFollowedUp && deal.negative_followed_up_at && (
                <p className="text-xs text-muted-foreground/60 font-mono mt-2">
                  {formatDateSafely(deal.negative_followed_up_at)}
                  {deal.negative_followed_up_by && allAdminProfiles?.[deal.negative_followed_up_by] && (
                    <span className="ml-1">by {allAdminProfiles[deal.negative_followed_up_by].displayName}</span>
                  )}
                </p>
              )}
            </div>
          </div>
            
          {otherDeals.length > 0 && (
            <div className="pt-2 px-4 border border-border/40 rounded-xl">
              <div className="py-3 space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Also update for {deal.contact_name || deal.contact_email}:
                </Label>
                <div className="space-y-1.5">
                  {otherDeals.map((otherDeal) => (
                    <div key={otherDeal.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`deal-overview-${otherDeal.id}`}
                        checked={selectedOtherDeals.includes(otherDeal.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOtherDeals([...selectedOtherDeals, otherDeal.id]);
                          } else {
                            setSelectedOtherDeals(selectedOtherDeals.filter(id => id !== otherDeal.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`deal-overview-${otherDeal.id}`}
                        className="text-xs text-foreground cursor-pointer flex items-center gap-2"
                      >
                        {otherDeal.listing_real_company_name || otherDeal.listing_title || otherDeal.deal_title}
                        {otherDeal.followed_up && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCheck className="h-2.5 w-2.5 mr-1" />
                            Followed
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Engagement Status - Second Priority */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Documents</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {/* NDA */}
            <div className="p-4 border border-border/40 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full ${
                    deal.nda_status === 'signed' ? 'bg-emerald-500' :
                    deal.nda_status === 'sent' ? 'bg-amber-500' :
                    'bg-muted-foreground/30'
                  }`} />
                  <div className="space-y-0.5">
                    <span className="text-sm text-foreground">NDA</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {deal.nda_status === 'signed' ? 'Signed' :
                         deal.nda_status === 'sent' ? 'Sent' : 'Not Sent'}
                      </span>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={deal.nda_status === 'signed'}
                  onCheckedChange={handleNDAToggle}
                  disabled={updateLeadNDA.isPending || !deal.connection_request_id}
                  className="scale-75"
                />
              </div>
            </div>

            {/* Fee Agreement */}
            <div className="p-4 border border-border/40 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full ${
                    deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' :
                    deal.fee_agreement_status === 'sent' ? 'bg-amber-500' :
                    'bg-muted-foreground/30'
                  }`} />
                  <div className="space-y-0.5">
                    <span className="text-sm text-foreground">Fee Agreement</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {deal.fee_agreement_status === 'signed' ? 'Signed' :
                         deal.fee_agreement_status === 'sent' ? 'Sent' : 'Not Sent'}
                      </span>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={deal.fee_agreement_status === 'signed'}
                  onCheckedChange={handleFeeAgreementToggle}
                  disabled={updateLeadFeeAgreement.isPending || !deal.connection_request_id}
                  className="scale-75"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Administrative Details - Lower Priority */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Administration</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Deal Owner</span>
              <Select 
                value={deal.assigned_to || 'unassigned'} 
                onValueChange={handleOwnerChange}
                disabled={adminProfilesLoading || updateDeal.isPending}
              >
                <SelectTrigger className="w-32 h-7 text-xs bg-muted/30 border-0">
                  <SelectValue placeholder="Assign..." />
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
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Stage Duration</span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDateSafely(deal.deal_stage_entered_at)}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">Deal Age</span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDateSafely(deal.deal_created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Task Summary */}
        {deal.total_tasks > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Task Summary</h2>
            
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{deal.total_tasks}</span>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-600">{deal.pending_tasks}</span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-600">{deal.completed_tasks}</span>
                <span className="text-xs text-muted-foreground">Done</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Action Required */}
        {(!deal.followed_up || deal.pending_tasks > 0) && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foreground">Action Required</h2>
            <div className="space-y-2">
              {!deal.followed_up && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-amber-700">Follow-up pending</span>
                </div>
              )}
              {deal.pending_tasks > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-blue-700">{deal.pending_tasks} pending task{deal.pending_tasks > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}