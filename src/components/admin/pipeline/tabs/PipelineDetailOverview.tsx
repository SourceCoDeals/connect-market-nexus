import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { DollarSign, Percent, Calendar, Phone, Mail, User, Building2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineDetailOverviewProps {
  deal: Deal;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  // Get all admin profiles for the dropdown, plus the currently assigned one
  const { data: allAdminProfiles } = useAdminProfiles([]);
  const { data: assignedAdminProfile } = useAdminProfiles([deal.assigned_to]);
  const updateDeal = useUpdateDeal();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleOwnerChange = (adminId: string | null) => {
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', score: 95, color: 'text-emerald-600' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', score: 75, color: 'text-amber-600' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', score, color: 'text-emerald-600' };
        if (score && score >= 40) return { level: 'Medium', score, color: 'text-amber-600' };
        return { level: 'Standard', score: score || 25, color: 'text-muted-foreground' };
      default:
        return { level: 'Standard', score: 25, color: 'text-muted-foreground' };
    }
  };

  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  const assignedAdmin = deal.assigned_to && assignedAdminProfile ? assignedAdminProfile[deal.assigned_to] : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 border-border/40">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">Deal Value</p>
                <p className="text-lg font-semibold mt-1">{formatCurrency(deal.deal_value)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/40">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">Probability</p>
                <p className="text-lg font-semibold mt-1">{deal.deal_probability}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Buyer Score */}
        <Card className="p-4 border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Buyer Priority Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-lg font-semibold ${buyerPriority.color}`}>
                    {buyerPriority.score}/100
                  </span>
                  <Badge variant="outline" className="text-xs border-border/60">
                    {buyerPriority.level}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Deal Owner */}
        <Card className="p-4 border-border/40">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Deal Owner</p>
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

        {/* Quick Actions */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start gap-2 h-10"
              disabled={!deal.contact_phone}
            >
              <Phone className="h-4 w-4" />
              <span className="text-sm">Call</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start gap-2 h-10"
              disabled={!deal.contact_email}
            >
              <Mail className="h-4 w-4" />
              <span className="text-sm">Email</span>
            </Button>
          </div>
        </div>

        {/* Contact & Listing Info */}
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Contact Information</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{deal.contact_name || 'Unknown'}</span>
              </div>
              {deal.contact_email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{deal.contact_email}</span>
                </div>
              )}
              {deal.contact_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{deal.contact_phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Listing</p>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm font-medium leading-relaxed">{deal.listing_title}</span>
            </div>
          </div>
        </div>

        {/* Timeline Info */}
        <div className="space-y-4">
          {deal.deal_expected_close_date && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Expected Close</p>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(deal.deal_expected_close_date), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Time in Stage</p>
              <p className="text-sm font-medium">
                {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {deal.pending_tasks > 0 && (
          <Card className="p-4 border-amber-200 bg-amber-50/50">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">Pending Tasks</p>
                <p className="text-xs text-amber-700">{deal.pending_tasks} task{deal.pending_tasks !== 1 ? 's' : ''} require attention</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}