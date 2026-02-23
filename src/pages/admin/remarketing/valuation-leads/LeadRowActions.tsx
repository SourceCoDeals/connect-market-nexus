import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast as sonnerToast } from 'sonner';
import {
  MoreHorizontal,
  ExternalLink,
  Sparkles,
  Users,
  Phone,
  Star,
  CheckCircle2,
  Archive,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValuationLead } from './types';

interface LeadRowActionsProps {
  lead: ValuationLead;
  onViewDeal: (lead: ValuationLead) => void;
  onPushAndEnrich: (ids: string[]) => void;
  onReEnrich: (ids: string[]) => void;
  onPushToAllDeals: (ids: string[]) => void;
  refetch: () => void;
}

export function LeadRowActions({
  lead,
  onViewDeal,
  onPushAndEnrich,
  onReEnrich,
  onPushToAllDeals,
  refetch,
}: LeadRowActionsProps) {
  const queryClient = useQueryClient();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* View Deal */}
        <DropdownMenuItem onClick={() => onViewDeal(lead)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View Deal
        </DropdownMenuItem>
        {/* Enrich Deal */}
        <DropdownMenuItem
          onClick={() => {
            if (lead.pushed_to_all_deals && lead.pushed_listing_id) {
              onReEnrich([lead.id]);
            } else {
              onPushAndEnrich([lead.id]);
            }
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Enrich Deal
        </DropdownMenuItem>
        {/* Flag: Needs Buyer Universe */}
        <DropdownMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            if (!lead.pushed_listing_id) {
              sonnerToast.error('Push deal to All Deals first');
              return;
            }
            const newVal = !lead.need_buyer_universe;
            await supabase
              .from('listings')
              .update({ need_buyer_universe: newVal })
              .eq('id', lead.pushed_listing_id);
            sonnerToast.success(newVal ? 'Flagged: Needs Buyer Universe' : 'Flag removed');
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
          }}
        >
          <Users className="h-4 w-4 mr-2" />
          Flag: Needs Buyer Universe
        </DropdownMenuItem>
        {/* Flag: Need to Contact Owner */}
        <DropdownMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            if (!lead.pushed_listing_id) {
              sonnerToast.error('Push deal to All Deals first');
              return;
            }
            const newVal = !lead.need_owner_contact;
            await supabase
              .from('listings')
              .update({ need_owner_contact: newVal })
              .eq('id', lead.pushed_listing_id);
            sonnerToast.success(newVal ? 'Flagged: Need to Contact Owner' : 'Flag removed');
            queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
          }}
        >
          <Phone className="h-4 w-4 mr-2" />
          Flag: Need to Contact Owner
        </DropdownMenuItem>
        {/* Mark as Priority */}
        <DropdownMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            const newVal = !lead.is_priority_target;
            const { error } = await supabase
              .from('valuation_leads')
              .update({ is_priority_target: newVal } as never)
              .eq('id', lead.id);
            if (error) {
              sonnerToast.error('Failed to update priority');
            } else {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
              sonnerToast.success(newVal ? 'Marked as priority' : 'Priority removed');
            }
          }}
          className={lead.is_priority_target ? 'text-amber-600' : ''}
        >
          <Star
            className={`h-4 w-4 mr-2 ${lead.is_priority_target ? 'fill-amber-500 text-amber-500' : ''}`}
          />
          {lead.is_priority_target ? 'Remove Priority' : 'Mark as Priority'}
        </DropdownMenuItem>
        {/* Needs Buyer Universe */}
        <DropdownMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            const newVal = !lead.needs_buyer_universe;
            const { error } = await supabase
              .from('valuation_leads')
              .update({ needs_buyer_universe: newVal } as never)
              .eq('id', lead.id);
            if (error) {
              sonnerToast.error('Failed to update flag');
            } else {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
              sonnerToast.success(newVal ? 'Flagged: Needs Buyer Universe' : 'Flag removed');
            }
          }}
          className={lead.needs_buyer_universe ? 'text-blue-600' : ''}
        >
          <Network className={cn('h-4 w-4 mr-2', lead.needs_buyer_universe && 'text-blue-600')} />
          {lead.needs_buyer_universe ? 'Remove Buyer Universe Flag' : 'Needs Buyer Universe'}
        </DropdownMenuItem>
        {/* Need to Contact Owner */}
        <DropdownMenuItem
          onClick={async (e) => {
            e.stopPropagation();
            const newVal = !lead.need_to_contact_owner;
            const { error } = await supabase
              .from('valuation_leads')
              .update({ need_to_contact_owner: newVal } as never)
              .eq('id', lead.id);
            if (error) {
              sonnerToast.error('Failed to update flag');
            } else {
              queryClient.invalidateQueries({ queryKey: ['remarketing', 'valuation-leads'] });
              sonnerToast.success(newVal ? 'Flagged: Need to Contact Owner' : 'Flag removed');
            }
          }}
          className={lead.need_to_contact_owner ? 'text-orange-600' : ''}
        >
          <Phone className={cn('h-4 w-4 mr-2', lead.need_to_contact_owner && 'text-orange-600')} />
          {lead.need_to_contact_owner ? 'Remove Contact Owner Flag' : 'Need to Contact Owner'}
        </DropdownMenuItem>
        {/* Approve to All Deals */}
        <DropdownMenuItem
          onClick={() => onPushToAllDeals([lead.id])}
          disabled={!!lead.pushed_to_all_deals}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Approve to All Deals
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Archive Deal */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={async () => {
            const { error } = await supabase
              .from('valuation_leads')
              .update({ is_archived: true })
              .eq('id', lead.id);
            if (error) {
              sonnerToast.error('Failed to archive lead');
            } else {
              sonnerToast.success('Lead archived');
              refetch();
            }
          }}
        >
          <Archive className="h-4 w-4 mr-2" />
          Archive Deal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
