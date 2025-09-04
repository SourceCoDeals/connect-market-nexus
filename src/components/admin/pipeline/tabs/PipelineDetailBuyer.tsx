import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { User, Building2, Mail, Phone, Calendar, Globe, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineDetailBuyerProps {
  deal: Deal;
}

export function PipelineDetailBuyer({ deal }: PipelineDetailBuyerProps) {
  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'Private Equity';
      case 'familyOffice': return 'Family Office';
      case 'searchFund': return 'Search Fund';
      case 'corporate': return 'Corporate';
      case 'individual': return 'Individual';
      case 'independentSponsor': return 'Independent Sponsor';
      case 'advisor': return 'Advisor / Banker';
      case 'businessOwner': return 'Business Owner';
      default: return 'Unknown';
    }
  };

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', score: 95, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', score: 75, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', score, color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (score && score >= 40) return { level: 'Medium', score, color: 'text-amber-600', bg: 'bg-amber-50' };
        return { level: 'Standard', score: score || 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
      default:
        return { level: 'Standard', score: 25, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
  };

  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Buyer Profile Card */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">
                    {deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN'}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{deal.contact_name || 'Unknown Contact'}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-medium ${buyerPriority.bg} ${buyerPriority.color} border-0`}>
                      {getBuyerTypeLabel(deal.buyer_type)}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-border/60">
                      Score: {buyerPriority.score}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              {deal.contact_email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{deal.contact_email}</span>
                </div>
              )}
              {deal.contact_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{deal.contact_phone}</span>
                </div>
              )}
              {deal.contact_company && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{deal.contact_company}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Buyer Intelligence */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Buyer Intelligence</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Priority Level</p>
                <Badge className={`${buyerPriority.bg} ${buyerPriority.color} border-0`}>
                  {buyerPriority.level} Priority
                </Badge>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Deal Velocity</p>
                <span className="text-sm font-medium">
                  {formatDistanceToNow(new Date(deal.deal_created_at))} old
                </span>
              </div>
            </div>

            {/* Buyer Persona Insights */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Buyer Insights</p>
              <div className="space-y-2">
                {deal.buyer_type === 'privateEquity' && (
                  <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium text-foreground">Private Equity Characteristics:</p>
                    <p>• Typically seeks $2M-$100M+ acquisitions</p>
                    <p>• Values operational improvements and growth</p>
                    <p>• Usually has 3-7 year investment horizon</p>
                  </div>
                )}
                {deal.buyer_type === 'searchFund' && (
                  <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium text-foreground">Search Fund Characteristics:</p>
                    <p>• Typically seeks $5M-$50M businesses</p>
                    <p>• Entrepreneur-led investment model</p>
                    <p>• Focuses on acquisition and hands-on management</p>
                  </div>
                )}
                {deal.buyer_type === 'individual' && (
                  <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium text-foreground">Individual Buyer Characteristics:</p>
                    <p>• Investment range varies significantly</p>
                    <p>• May seek lifestyle or growth businesses</p>
                    <p>• Decision making often more personal</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Connection History */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Connection History</h4>
            
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                First contact: {formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}
              </div>
              
              {/* Placeholder for connection requests */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Previous Connections</p>
                <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                  No previous connection requests found for this buyer.
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Saved Listings */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Saved Listings</h4>
            
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                No saved listings data available for this buyer.
              </div>
            </div>
          </div>
        </Card>

        {/* Engagement Timeline */}
        <Card className="p-5 border-border/40">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Buyer Journey</h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Deal Created</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Current Stage: {deal.stage_name}</p>
                  <p className="text-xs text-muted-foreground">
                    In stage for {formatDistanceToNow(new Date(deal.deal_stage_entered_at))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}